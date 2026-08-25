"""
Kete — INFS803 A02 backend (stub API).

All 17 endpoints exist with the agreed request/response shapes but return
hard-coded sample data. Nick can build every screen against this immediately;
Jack replaces the bodies with real logic + database calls one at a time.

The shape must NOT change when the real logic lands — that is the whole point.

Run locally:   uvicorn main:app --reload
Interactive docs: http://localhost:8000/docs
"""

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
# TODO: move to environment variables before deploying to EC2.
JWT_SECRET = "dev-only-secret-replace-me-with-a-32-byte-env-var"
JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 12

app = FastAPI(
    title="Kete API",
    version="0.1.0-stub",
    description="Nutrition-aware meal planner. Stub responses — shapes are final.",
)

# CORS: the Angular client is served from a different origin (S3) than this API
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
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def make_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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


# --------------------------------------------------------------------------
# Sample data — delete as each endpoint gets real logic
# --------------------------------------------------------------------------
SAMPLE_RECIPES = [
    RecipeDetail(recipe_id=1, name="Chicken & rice bowl", cuisine="Asian",
                 ingredients="rice, chicken, soy sauce", steps="Cook rice. Fry chicken. Combine.",
                 servings=4, energy_kcal=540, protein_g=42, carbs_g=55, fat_g=14,
                 photo_url="https://kete-photos.s3.amazonaws.com/1.jpg"),
    RecipeDetail(recipe_id=2, name="Veggie stir-fry", cuisine="Asian",
                 ingredients="broccoli, tofu, noodles", steps="Fry everything.",
                 servings=2, energy_kcal=410, protein_g=22, carbs_g=48, fat_g=12,
                 photo_url="https://kete-photos.s3.amazonaws.com/2.jpg"),
    RecipeDetail(recipe_id=3, name="Salmon & greens", cuisine="Modern",
                 ingredients="salmon, spinach, lemon", steps="Bake salmon. Wilt greens.",
                 servings=2, energy_kcal=620, protein_g=48, carbs_g=18, fat_g=38,
                 photo_url="https://kete-photos.s3.amazonaws.com/3.jpg"),
]


# ==========================================================================
# 1-2  Auth  (PUBLIC — no token)
# ==========================================================================
@app.post("/register", response_model=RegisterOut, status_code=201, tags=["auth"])
def register(body: RegisterIn):
    # TODO: hash password, INSERT INTO users, handle duplicate username/email (409)
    return RegisterOut(user_id=1)


@app.post("/login", response_model=LoginOut, tags=["auth"])
def login(body: LoginIn):
    # TODO: SELECT user by username or email, verify password hash
    return LoginOut(token=make_token(1), user_id=1)


# ==========================================================================
# 3-6  Profile, metrics and targets  (protected)
# ==========================================================================
@app.get("/profile", response_model=ProfileOut, tags=["profile"])
def get_profile(user_id: int = Depends(current_user_id)):
    # TODO: SELECT ... FROM users WHERE user_id = ?
    return ProfileOut(first_name="Jack", last_name="Smith",
                      username="jacksmith", email="jack@example.com")


@app.put("/profile", response_model=ProfileOut, tags=["profile"])
def update_profile(body: ProfileIn, user_id: int = Depends(current_user_id)):
    # TODO: UPDATE users SET ... WHERE user_id = ?
    return ProfileOut(**body.model_dump())


@app.post("/profile/metrics", response_model=TargetsOut, tags=["profile"])
def save_metrics(body: MetricsIn, user_id: int = Depends(current_user_id)):
    """One request, two tables: UPSERT profiles, run the engine, UPSERT targets."""
    targets = compute_targets(body.weight_kg, body.height_cm, body.age,
                              body.sex, body.activity_level)
    # TODO: UPSERT profiles, then UPSERT nutrition_targets with `targets`
    return TargetsOut(**targets, computed_at=datetime.now(timezone.utc))


@app.get("/targets", response_model=TargetsOut, tags=["profile"])
def get_targets(user_id: int = Depends(current_user_id)):
    # TODO: SELECT ... FROM nutrition_targets WHERE user_id = ?
    return TargetsOut(energy_kcal=2480, protein_g=186, carbs_g=248, fat_g=83,
                      computed_at=datetime.now(timezone.utc))


# ==========================================================================
# 7-12  Recipes  (protected)
# ==========================================================================
@app.get("/recipes", response_model=list[RecipeSummary], tags=["recipes"])
def list_recipes(q: str = "", user_id: int = Depends(current_user_id)):
    # TODO: SELECT ... WHERE user_id = ? AND name ILIKE %q%
    items = [r for r in SAMPLE_RECIPES if q.lower() in r.name.lower()]
    return [RecipeSummary(**r.model_dump()) for r in items]


@app.get("/recipes/{recipe_id}", response_model=RecipeDetail, tags=["recipes"])
def get_recipe(recipe_id: int, user_id: int = Depends(current_user_id)):
    # TODO: SELECT ... WHERE recipe_id = ? AND user_id = ?
    for r in SAMPLE_RECIPES:
        if r.recipe_id == recipe_id:
            return r
    raise HTTPException(status_code=404, detail="Recipe not found")


@app.post("/recipes", response_model=RecipeCreatedOut, status_code=201, tags=["recipes"])
def create_recipe(body: RecipeIn, user_id: int = Depends(current_user_id)):
    # TODO: INSERT INTO recipes (user_id = owner) RETURNING recipe_id
    return RecipeCreatedOut(recipe_id=4)


@app.post("/recipes/{recipe_id}/photo", response_model=PhotoOut, tags=["recipes"])
def upload_photo(recipe_id: int, file: UploadFile = File(...),
                 user_id: int = Depends(current_user_id)):
    # TODO: put the object in S3, then UPDATE recipes SET photo_url = ?
    return PhotoOut(photo_url=f"https://kete-photos.s3.amazonaws.com/{recipe_id}.jpg")


@app.put("/recipes/{recipe_id}", response_model=RecipeDetail, tags=["recipes"])
def update_recipe(recipe_id: int, body: RecipeIn, user_id: int = Depends(current_user_id)):
    # TODO: UPDATE recipes SET ... WHERE recipe_id = ? AND user_id = ?
    return RecipeDetail(recipe_id=recipe_id, photo_url=None, **body.model_dump())


@app.delete("/recipes/{recipe_id}", status_code=204, tags=["recipes"])
def delete_recipe(recipe_id: int, user_id: int = Depends(current_user_id)):
    # TODO: DELETE FROM recipes WHERE recipe_id = ? AND user_id = ?
    return Response(status_code=204)


# ==========================================================================
# 13-17  Weekly meal plan  (protected)
# ==========================================================================
@app.get("/mealplan", response_model=list[PlanSlotOut], tags=["mealplan"])
def get_mealplan(week: str, user_id: int = Depends(current_user_id)):
    # TODO: SELECT plan_slots JOIN recipes WHERE user_id = ? AND week = ?
    return [
        PlanSlotOut(slot_id=1, day_of_week="Mon", meal_position="dinner",
                    recipe=PlanRecipe(recipe_id=1, name="Chicken & rice bowl")),
        PlanSlotOut(slot_id=2, day_of_week="Tue", meal_position="lunch",
                    recipe=PlanRecipe(recipe_id=2, name="Veggie stir-fry")),
    ]


@app.post("/mealplan", response_model=PlanSlotCreatedOut, status_code=201, tags=["mealplan"])
def add_plan_slot(body: PlanSlotIn, user_id: int = Depends(current_user_id)):
    # TODO: INSERT INTO plan_slots; 409 if that slot is already taken
    return PlanSlotCreatedOut(slot_id=3)


@app.delete("/mealplan/{slot_id}", status_code=204, tags=["mealplan"])
def remove_plan_slot(slot_id: int, user_id: int = Depends(current_user_id)):
    # TODO: DELETE FROM plan_slots WHERE slot_id = ? AND user_id = ?
    return Response(status_code=204)


@app.post("/mealplan/generate", response_model=GenerateOut, status_code=201, tags=["mealplan"])
def generate_week(body: GenerateIn, user_id: int = Depends(current_user_id)):
    # TODO: SELECT the user's recipes, fill 7 days x 3 meals, bulk INSERT
    return GenerateOut(created=21)


@app.delete("/mealplan/week/{week}", status_code=204, tags=["mealplan"])
def clear_week(week: str, user_id: int = Depends(current_user_id)):
    # TODO: DELETE FROM plan_slots WHERE user_id = ? AND week = ?
    return Response(status_code=204)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "mode": "stub"}
