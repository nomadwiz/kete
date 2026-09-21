"""
Kete — INFS803 A02 backend.

Seventeen endpoints over PostgreSQL: accounts and JWT auth, each user's own
recipe library, their weekly meal plan, and the nutrition targets computed
from their measurements by the Mifflin-St Jeor equation.

Every endpoint except /register and /login takes the user id from the bearer
token rather than from the request, and scopes its queries by it, so one
account cannot reach another's rows.

The request and response shapes are the API contract the client is built
against. Do not change one without telling the team.

Run locally:   uvicorn main:app --reload
Interactive docs: http://localhost:8000/docs
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from database import get_db
import storage
from security import hash_password, make_token, read_token, verify_password

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
app = FastAPI(
    title="Kete API",
    version="0.1.0",
    description=(
        "Nutrition-aware meal planner. Record your measurements once, write "
        "your own recipes, arrange them into a week, and see the week's totals "
        "against your computed targets."
    ),
)

# CORS: the React client is served from a different origin (S3) than this API
# (EC2), so without this every browser call is blocked. Tighten the origin list
# once the real S3 URL exists.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO: replace with the S3 site URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer(auto_error=True)


def current_user_id(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    """Read user_id out of the JWT. Every protected query is scoped by this."""
    try:
        return read_token(cred.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# --------------------------------------------------------------------------
# Nutrition engine — real logic, no database needed
# --------------------------------------------------------------------------
ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}
# TODO: team to confirm the split. 30 / 40 / 30 protein / carbs / fat.
MACRO_SPLIT = {"protein": 0.30, "carbs": 0.40, "fat": 0.30}


def compute_targets(weight_kg: float, height_cm: float, age: int,
                    sex: str, activity_level: str) -> dict:
    """Mifflin-St Jeor BMR, then TDEE, then a macro split in grams."""
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "male" else -161)
    tdee = bmr * ACTIVITY_FACTORS[activity_level]
    return {
        "energy_kcal": round(tdee),
        "protein_g": round(tdee * MACRO_SPLIT["protein"] / 4),
        "carbs_g": round(tdee * MACRO_SPLIT["carbs"] / 4),
        "fat_g": round(tdee * MACRO_SPLIT["fat"] / 9),
    }


# --------------------------------------------------------------------------
# Request / response models — these ARE the contract
# --------------------------------------------------------------------------
Sex = Literal["male", "female"]
Activity = Literal["sedentary", "light", "moderate", "active", "very_active"]
MealPosition = Literal["breakfast", "lunch", "dinner"]


class RegisterIn(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    password: str = Field(min_length=8)


class RegisterOut(BaseModel):
    user_id: int


class LoginIn(BaseModel):
    username_or_email: str
    password: str


class LoginOut(BaseModel):
    token: str
    user_id: int


class ProfileOut(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr


class ProfileIn(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr


class MetricsIn(BaseModel):
    weight_kg: float
    height_cm: float
    age: int
    sex: Sex
    activity_level: Activity


class TargetsOut(BaseModel):
    energy_kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int
    computed_at: Optional[datetime] = None


class RecipeSummary(BaseModel):
    recipe_id: int
    name: str
    cuisine: str
    energy_kcal: int
    photo_url: Optional[str] = None


class RecipeDetail(RecipeSummary):
    ingredients: str
    steps: str
    servings: int
    protein_g: int
    carbs_g: int
    fat_g: int


class RecipeIn(BaseModel):
    name: str
    cuisine: str
    ingredients: str
    steps: str
    servings: int
    energy_kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int


class RecipeCreatedOut(BaseModel):
    recipe_id: int


class PhotoOut(BaseModel):
    photo_url: str


class PlanRecipe(BaseModel):
    recipe_id: int
    name: str


class PlanSlotOut(BaseModel):
    slot_id: int
    day_of_week: str
    meal_position: MealPosition
    recipe: PlanRecipe


class PlanSlotIn(BaseModel):
    recipe_id: int
    week: str
    day_of_week: str
    meal_position: MealPosition


class PlanSlotCreatedOut(BaseModel):
    slot_id: int


class GenerateIn(BaseModel):
    week: str


class GenerateOut(BaseModel):
    created: int


# ==========================================================================
# 1-2  Auth  (PUBLIC — no token)
# ==========================================================================
@app.post("/register", response_model=RegisterOut, status_code=201, tags=["auth"])
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Create a user row. The password is hashed; the plain text is never stored."""
    clash = db.query(models.User).filter(
        or_(models.User.username == body.username,
            models.User.email == body.email)
    ).first()
    if clash:
        field = "username" if clash.username == body.username else "email"
        raise HTTPException(status_code=409, detail=f"That {field} is already taken")

    user = models.User(
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)       # stage the new row
    db.commit()        # actually write it
    db.refresh(user)   # read back what the database assigned (user_id)
    return RegisterOut(user_id=user.user_id)


@app.post("/login", response_model=LoginOut, tags=["auth"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Find the user, check the password, hand back a token."""
    user = db.query(models.User).filter(
        or_(models.User.username == body.username_or_email,
            models.User.email == body.username_or_email)
    ).first()

    # Same message whether the user is missing or the password is wrong, so an
    # attacker cannot use it to discover which usernames exist.
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    return LoginOut(token=make_token(user.user_id), user_id=user.user_id)


# ==========================================================================
# 3-6  Profile, metrics and targets  (protected)
# ==========================================================================
@app.get("/profile", response_model=ProfileOut, tags=["profile"])
def get_profile(user_id: int = Depends(current_user_id),
                db: Session = Depends(get_db)):
    """Return the signed-in user. user_id comes from the token, never the client."""
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ProfileOut(first_name=user.first_name, last_name=user.last_name,
                      username=user.username, email=user.email)


@app.put("/profile", response_model=ProfileOut, tags=["profile"])
def update_profile(body: ProfileIn, user_id: int = Depends(current_user_id),
                   db: Session = Depends(get_db)):
    """Update the signed-in user's account details."""
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # someone ELSE must not already hold this username or email
    clash = db.query(models.User).filter(
        models.User.user_id != user_id,
        or_(models.User.username == body.username,
            models.User.email == body.email),
    ).first()
    if clash:
        field = "username" if clash.username == body.username else "email"
        raise HTTPException(status_code=409, detail=f"That {field} is already taken")

    user.first_name = body.first_name
    user.last_name = body.last_name
    user.username = body.username
    user.email = body.email
    db.commit()
    db.refresh(user)
    return ProfileOut(first_name=user.first_name, last_name=user.last_name,
                      username=user.username, email=user.email)


@app.post("/profile/metrics", response_model=TargetsOut, tags=["profile"])
def save_metrics(body: MetricsIn, user_id: int = Depends(current_user_id),
                 db: Session = Depends(get_db)):
    """One request, two tables.

    1. Save the raw body metrics into `profiles`.
    2. Run the nutrition engine on them.
    3. Save the computed result into `nutrition_targets`.

    Both writes happen in a single transaction, so either both land or neither
    does. That matters: stored targets must never disagree with the metrics
    they came from.
    """
    if not db.get(models.User, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    # --- 1. the raw metrics (create the row first time, update it after) ---
    profile = db.query(models.Profile).filter_by(user_id=user_id).first()
    if profile is None:
        profile = models.Profile(user_id=user_id)
        db.add(profile)
    profile.weight_kg = body.weight_kg
    profile.height_cm = body.height_cm
    profile.age = body.age
    profile.sex = body.sex
    profile.activity_level = body.activity_level

    # --- 2. the engine ---
    computed = compute_targets(body.weight_kg, body.height_cm, body.age,
                               body.sex, body.activity_level)

    # --- 3. the derived targets ---
    target = db.query(models.NutritionTarget).filter_by(user_id=user_id).first()
    if target is None:
        target = models.NutritionTarget(user_id=user_id)
        db.add(target)
    target.energy_kcal = computed["energy_kcal"]
    target.protein_g = computed["protein_g"]
    target.carbs_g = computed["carbs_g"]
    target.fat_g = computed["fat_g"]
    target.computed_at = datetime.now(timezone.utc)

    db.commit()          # both rows written together
    db.refresh(target)

    return TargetsOut(energy_kcal=int(target.energy_kcal),
                      protein_g=int(target.protein_g),
                      carbs_g=int(target.carbs_g),
                      fat_g=int(target.fat_g),
                      computed_at=target.computed_at)


@app.get("/targets", response_model=TargetsOut, tags=["profile"])
def get_targets(user_id: int = Depends(current_user_id),
                db: Session = Depends(get_db)):
    """Read the computed targets.

    Note this reads `nutrition_targets` only. It never touches `profiles`, so
    the sensitive body metrics are not re-read every time a screen loads.
    """
    target = db.query(models.NutritionTarget).filter_by(user_id=user_id).first()
    if target is None:
        raise HTTPException(
            status_code=404,
            detail="No targets yet — save your body metrics first")
    return TargetsOut(energy_kcal=int(target.energy_kcal),
                      protein_g=int(target.protein_g),
                      carbs_g=int(target.carbs_g),
                      fat_g=int(target.fat_g),
                      computed_at=target.computed_at)


# ==========================================================================
# 7-12  Recipes  (protected)
# ==========================================================================
def _owned_recipe(db: Session, recipe_id: int, user_id: int) -> models.Recipe:
    """Fetch a recipe, but only if it belongs to the signed-in user.

    Returning 404 (rather than 403) for someone else's recipe is deliberate: it
    does not reveal that the recipe exists at all.
    """
    recipe = db.query(models.Recipe).filter_by(
        recipe_id=recipe_id, user_id=user_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


def _summary(r: models.Recipe) -> RecipeSummary:
    return RecipeSummary(recipe_id=r.recipe_id, name=r.name,
                         cuisine=r.cuisine or "",
                         energy_kcal=int(r.energy_kcal or 0),
                         photo_url=storage.link_for(r.photo_url))


def _detail(r: models.Recipe) -> RecipeDetail:
    return RecipeDetail(recipe_id=r.recipe_id, name=r.name,
                        cuisine=r.cuisine or "",
                        ingredients=r.ingredients or "", steps=r.steps or "",
                        servings=r.servings,
                        energy_kcal=int(r.energy_kcal or 0),
                        protein_g=int(r.protein_g or 0),
                        carbs_g=int(r.carbs_g or 0),
                        fat_g=int(r.fat_g or 0),
                        photo_url=storage.link_for(r.photo_url))


@app.get("/recipes", response_model=list[RecipeSummary], tags=["recipes"])
def list_recipes(q: str = "", user_id: int = Depends(current_user_id),
                 db: Session = Depends(get_db)):
    """Browse and search. Scoped to the signed-in user by the token."""
    query = db.query(models.Recipe).filter_by(user_id=user_id)
    if q:
        query = query.filter(models.Recipe.name.ilike(f"%{q}%"))
    return [_summary(r) for r in query.order_by(models.Recipe.name).all()]


@app.get("/recipes/{recipe_id}", response_model=RecipeDetail, tags=["recipes"])
def get_recipe(recipe_id: int, user_id: int = Depends(current_user_id),
               db: Session = Depends(get_db)):
    return _detail(_owned_recipe(db, recipe_id, user_id))


@app.post("/recipes", response_model=RecipeCreatedOut, status_code=201, tags=["recipes"])
def create_recipe(body: RecipeIn, user_id: int = Depends(current_user_id),
                  db: Session = Depends(get_db)):
    recipe = models.Recipe(user_id=user_id, **body.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return RecipeCreatedOut(recipe_id=recipe.recipe_id)


@app.post("/recipes/{recipe_id}/photo", response_model=PhotoOut, tags=["recipes"])
def upload_photo(recipe_id: int, file: UploadFile = File(...),
                 user_id: int = Depends(current_user_id),
                 db: Session = Depends(get_db)):
    """Store a recipe photograph in S3 and keep only its key in the database.

    The bucket is private, so the response carries a time-limited link rather
    than a permanent URL.
    """
    if not storage.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Photo storage is not configured on this server (S3_BUCKET).",
        )

    recipe = _owned_recipe(db, recipe_id, user_id)   # 404s if it is not theirs

    if file.content_type not in storage.ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Allowed: "
                   + ", ".join(sorted(storage.ALLOWED_TYPES)),
        )

    data = file.file.read(storage.MAX_BYTES + 1)
    if len(data) > storage.MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is larger than {storage.MAX_BYTES // (1024 * 1024)} MB.",
        )
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    previous = recipe.photo_url
    key = storage.build_key(user_id, recipe_id, file.content_type)
    try:
        storage.upload(key, data, file.content_type)
    except storage.StorageNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=502, detail="Could not store the image.")

    recipe.photo_url = key
    db.commit()

    # Only once the new object is safely recorded do we remove the old one.
    if previous and previous != key:
        storage.delete(previous)

    return PhotoOut(photo_url=storage.link_for(key))


@app.put("/recipes/{recipe_id}", response_model=RecipeDetail, tags=["recipes"])
def update_recipe(recipe_id: int, body: RecipeIn,
                  user_id: int = Depends(current_user_id),
                  db: Session = Depends(get_db)):
    recipe = _owned_recipe(db, recipe_id, user_id)
    for field, value in body.model_dump().items():
        setattr(recipe, field, value)
    db.commit()
    db.refresh(recipe)
    return _detail(recipe)


@app.delete("/recipes/{recipe_id}", status_code=204, tags=["recipes"])
def delete_recipe(recipe_id: int, user_id: int = Depends(current_user_id),
                  db: Session = Depends(get_db)):
    """Delete a recipe. Any meal-plan slots using it go too (ON DELETE CASCADE)."""
    recipe = _owned_recipe(db, recipe_id, user_id)
    key = recipe.photo_url              # remember it before the row disappears
    db.delete(recipe)
    db.commit()
    storage.delete(key)                 # tidy up the object, best effort
    return Response(status_code=204)


# ==========================================================================
# 13-17  Weekly meal plan  (protected)
# ==========================================================================
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MEALS = ["breakfast", "lunch", "dinner"]


def _slot_out(s: models.PlanSlot) -> PlanSlotOut:
    return PlanSlotOut(slot_id=s.slot_id, day_of_week=s.day_of_week,
                       meal_position=s.meal_position,
                       recipe=PlanRecipe(recipe_id=s.recipe.recipe_id,
                                         name=s.recipe.name))


@app.get("/mealplan", response_model=list[PlanSlotOut], tags=["mealplan"])
def get_mealplan(week: str, user_id: int = Depends(current_user_id),
                 db: Session = Depends(get_db)):
    """The week's plan, each slot with its recipe. This is the JOIN."""
    slots = (db.query(models.PlanSlot)
               .filter_by(user_id=user_id, week=week)
               .join(models.Recipe)
               .order_by(models.PlanSlot.slot_id)
               .all())
    return [_slot_out(s) for s in slots]


@app.post("/mealplan", response_model=PlanSlotCreatedOut, status_code=201, tags=["mealplan"])
def add_plan_slot(body: PlanSlotIn, user_id: int = Depends(current_user_id),
                  db: Session = Depends(get_db)):
    """Put one recipe in one day-and-meal slot."""
    if body.day_of_week not in DAYS:
        raise HTTPException(status_code=422,
                            detail=f"day_of_week must be one of {DAYS}")
    _owned_recipe(db, body.recipe_id, user_id)   # 404 if not yours

    taken = db.query(models.PlanSlot).filter_by(
        user_id=user_id, week=body.week,
        day_of_week=body.day_of_week, meal_position=body.meal_position).first()
    if taken:
        raise HTTPException(
            status_code=409,
            detail=f"{body.day_of_week} {body.meal_position} is already filled")

    slot = models.PlanSlot(user_id=user_id, recipe_id=body.recipe_id,
                           week=body.week, day_of_week=body.day_of_week,
                           meal_position=body.meal_position)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return PlanSlotCreatedOut(slot_id=slot.slot_id)


@app.delete("/mealplan/{slot_id}", status_code=204, tags=["mealplan"])
def remove_plan_slot(slot_id: int, user_id: int = Depends(current_user_id),
                     db: Session = Depends(get_db)):
    slot = db.query(models.PlanSlot).filter_by(
        slot_id=slot_id, user_id=user_id).first()
    if slot is None:
        raise HTTPException(status_code=404, detail="Plan slot not found")
    db.delete(slot)
    db.commit()
    return Response(status_code=204)


@app.post("/mealplan/generate", response_model=GenerateOut, status_code=201, tags=["mealplan"])
def generate_week(body: GenerateIn, user_id: int = Depends(current_user_id),
                  db: Session = Depends(get_db)):
    """Fill a whole week from the user's recipe library.

    Clears the week first, then deals recipes round-robin across all 21 slots,
    so the same recipe does not land twice in a row while the library is small.

    Choosing recipes to best hit the nutrition targets is future work; this
    version just fills the week.
    """
    recipes = db.query(models.Recipe).filter_by(user_id=user_id).order_by(
        models.Recipe.recipe_id).all()
    if not recipes:
        raise HTTPException(
            status_code=400,
            detail="Add at least one recipe before generating a week")

    db.query(models.PlanSlot).filter_by(user_id=user_id, week=body.week).delete()

    created = 0
    for day in DAYS:
        for meal in MEALS:
            db.add(models.PlanSlot(
                user_id=user_id,
                recipe_id=recipes[created % len(recipes)].recipe_id,
                week=body.week, day_of_week=day, meal_position=meal))
            created += 1

    db.commit()
    return GenerateOut(created=created)


@app.delete("/mealplan/week/{week}", status_code=204, tags=["mealplan"])
def clear_week(week: str, user_id: int = Depends(current_user_id),
               db: Session = Depends(get_db)):
    """Empty an entire week. Recipes themselves are untouched."""
    db.query(models.PlanSlot).filter_by(user_id=user_id, week=week).delete()
    db.commit()
    return Response(status_code=204)


@app.get("/health", tags=["meta"])
def health():
    """Liveness only: is the process up and serving?

    Deliberately does not touch the database. A health check that fails when
    the database is unreachable is a readiness check, and behind a load
    balancer it takes the instance out of service for a fault it cannot fix
    by restarting. If a database probe is wanted, it belongs at its own path.
    """
    return {"status": "ok"}
