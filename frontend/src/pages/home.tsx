import { Fragment } from "react";
import { Link } from "react-router";

import { PATHS } from "../routes";
import "./home.css";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];

// Breakfast to dinner, Monday to Sunday. "#" is a planned position.
const WEEK = ["##.###.", "#.##..#", "###.##."].map((meal) =>
  [...meal].map((position) => position === "#"),
);

const STEPS = [
  {
    title: "Record your measurements",
    detail:
      "Weight, height, age, sex and activity level. Kete works out your daily energy, protein, carbohydrate and fat targets, and keeps them.",
  },
  {
    title: "Write your recipes",
    detail:
      "Name, cuisine, ingredients, method, how many servings it makes, and the nutrition per serving. You supply the nutrition figures; Kete does not look them up.",
  },
  {
    title: "Fill the week",
    detail:
      "Twenty-one positions: breakfast, lunch and dinner across seven days. Place recipes yourself, or fill the week from your library in one action.",
  },
  {
    title: "Check each day",
    detail:
      "The day's planned totals against your targets, nutrient by nutrient, with the difference. Every figure on the screen adds up on a calculator.",
  },
];

export default function Home() {
  const signUp = PATHS.sign_up;
  const signIn = PATHS.sign_in;

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-inner">
          <div>
            <h1 className="home-title">
              A week you can check before you cook.
            </h1>
            <p className="home-lede">
              Kete works out what your body needs from your measurements, keeps
              the recipes you write, and shows how each day of your plan
              compares with your targets.
            </p>
            <div className="home-actions">
              <Link className="home-action home-action--primary" to={signUp}>
                Create an account
              </Link>
              <Link className="home-action home-action--secondary" to={signIn}>
                Sign in
              </Link>
            </div>
          </div>

          <figure className="home-weave">
            <div className="home-weave__grid" aria-hidden="true">
              <span />
              {DAYS.map((day, column) => (
                <span className="home-weave__day" key={column}>
                  {day}
                </span>
              ))}
              {MEALS.map((meal, row) => (
                <Fragment key={meal}>
                  <span className="home-weave__meal">{meal}</span>
                  {DAYS.map((_, column) => (
                    <span
                      key={column}
                      className={
                        WEEK[row]?.[column]
                          ? "home-weave__cell home-weave__cell--filled"
                          : "home-weave__cell"
                      }
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            <figcaption>Seven days, three meals, one basket.</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-steps">
        <div className="home-inner">
          <h2>What you do</h2>
          <ol className="home-steps__list">
            {STEPS.map((step, index) => (
              <li className="home-steps__item" key={step.title}>
                <span className="home-steps__n">{index + 1}</span>
                <div>
                  <p className="home-steps__title">{step.title}</p>
                  <p className="home-steps__detail">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-close">
        <div className="home-inner">
          <p className="home-close__line">
            Your measurements, your recipes, your week.
          </p>
          <Link className="home-action home-action--primary" to={signUp}>
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}
