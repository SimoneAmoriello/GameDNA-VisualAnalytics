from __future__ import annotations

import argparse
import ast
import csv
import re
from pathlib import Path

import numpy as np
import pandas as pd


# CONFIGURATION

REFERENCE_DATE = pd.Timestamp("2026-08-17")

TARGET_SAMPLE_SIZE = 5000
RANDOM_SEED = 2025
MIN_REVIEWS = 100


# Genres that identify actual videogames

GAMEPLAY_GENRES = {
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Casual",
    "Sports",
    "Racing",
    "Massively Multiplayer",
}


# Genres associated mainly with software/tools rather than games

EXCLUDED_SOFTWARE_GENRES = {
    "Utilities",
    "Design & Illustration",
    "Education",
    "Game Development",
    "Animation & Modeling",
    "Audio Production",
    "Video Production",
    "Web Publishing",
    "Photo Editing",
    "Accounting",
    "Software Training",
}


# Auxiliary/non-final Steam products

TITLE_EXCLUSION_PATTERN = re.compile(
    r"(?:Playtest|Demo$|Dedicated Server|Test Server|Soundtrack$)",
    flags=re.IGNORECASE
)


POPULARITY_ORDER = [
    "Niche (≤50k owners)",
    "Emerging (50k–200k)",
    "Established (200k–1M)",
    "Hit (≥1M)",
]


ERA_ORDER = [
    "≤2010",
    "2011-2015",
    "2016-2020",
    "2021-2026",
]


# LOAD ORIGINAL DATASET

def read_corrected_header(path: Path) -> list[str]:

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.reader(file)
        header = next(reader)

    if "DiscountDLC count" in header:

        index = header.index("DiscountDLC count")

        header = (
            header[:index]
            + ["Discount", "DLC count"]
            + header[index + 1:]
        )

    return header


def load_raw_dataset(path: Path) -> pd.DataFrame:

    corrected_header = read_corrected_header(path)

    df = pd.read_csv(
        path,
        header=0,
        names=corrected_header,
        encoding="utf-8-sig",
        low_memory=False
    )

    return df


# HELPER FUNCTIONS

def parse_genres(value) -> set[str]:

    if pd.isna(value):
        return set()

    return {
        genre.strip()
        for genre in str(value).split(",")
        if genre.strip()
    }


def parse_language_count(value) -> int:

    if pd.isna(value):
        return 0

    text = str(value).strip()

    if not text:
        return 0

    try:

        parsed = ast.literal_eval(text)

        if isinstance(
            parsed,
            (list, tuple, set)
        ):
            return len(parsed)

    except (ValueError, SyntaxError):
        pass

    text = text.strip("[]")

    if not text:
        return 0

    languages = [
        language
        for language in text.split(",")
        if language.strip()
    ]

    return len(languages)


def owners_upper_bound(value) -> float:

    if pd.isna(value):
        return np.nan

    text = str(value).replace(",", "")

    numbers = re.findall(
        r"\d+",
        text
    )

    if not numbers:
        return np.nan

    return float(numbers[-1])


def get_popularity_tier(value):

    upper = owners_upper_bound(value)

    if pd.isna(upper) or upper <= 0:
        return None

    if upper <= 50_000:
        return "Niche (≤50k owners)"

    if upper <= 200_000:
        return "Emerging (50k–200k)"

    if upper <= 1_000_000:
        return "Established (200k–1M)"

    return "Hit (≥1M)"


def get_release_era(date):

    if pd.isna(date):
        return None

    year = int(date.year)

    if year <= 2010:
        return "≤2010"

    if year <= 2015:
        return "2011-2015"

    if year <= 2020:
        return "2016-2020"

    if year <= 2026:
        return "2021-2026"

    return None


def get_sample_quota(
    stratum_size: int,
    total_size: int
) -> int:

    proportion = stratum_size / total_size

    quota = round(
        proportion * TARGET_SAMPLE_SIZE
    )

    return quota


# FEATURE ENGINEERING

def create_features(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    numeric_columns = [
        "Price",
        "Discount",
        "DLC count",
        "Positive",
        "Negative",
        "Average playtime forever",
    ]

    for column in numeric_columns:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )


    df["Release date"] = pd.to_datetime(
        df["Release date"],
        errors="coerce"
    )


    df["Total Reviews"] = (
        df["Positive"].fillna(0)
        + df["Negative"].fillna(0)
    )


    df["Positive Ratio"] = np.where(

        df["Total Reviews"] > 0,

        df["Positive"]
        / df["Total Reviews"],

        np.nan
    )


    df["Base Price"] = df["Price"]


    valid_discount = (

        df["Discount"].notna()

        & (df["Discount"] > 0)

        & (df["Discount"] < 100)
    )


    df.loc[
        valid_discount,
        "Base Price"
    ] = (

        df.loc[
            valid_discount,
            "Price"
        ]

        /

        (
            1
            -
            df.loc[
                valid_discount,
                "Discount"
            ]
            / 100
        )
    )


    age_days = (

        REFERENCE_DATE

        -

        df["Release date"]

    ).dt.days


    df["Release Age Years"] = (

        age_days / 365.25

    )


    df["Language Count"] = (

        df["Supported languages"]
        .apply(parse_language_count)

    )


    df["Popularity Tier"] = (

        df["Estimated owners"]
        .apply(get_popularity_tier)

    )


    df["Release Era"] = (

        df["Release date"]
        .apply(get_release_era)

    )


    return df


# QUALITY FILTERING

def apply_quality_filter(
    df: pd.DataFrame
) -> pd.DataFrame:

    genres = (

        df["Genres"]
        .apply(parse_genres)

    )


    has_gameplay_genre = (

        genres.apply(

            lambda x:
            bool(
                x & GAMEPLAY_GENRES
            )

        )

    )


    has_software_genre = (

        genres.apply(

            lambda x:
            bool(
                x & EXCLUDED_SOFTWARE_GENRES
            )

        )

    )


    valid_title = (

        ~df["Name"]
        .fillna("")
        .str.contains(
            TITLE_EXCLUSION_PATTERN,
            regex=True,
            na=False
        )

    )


    valid_release = (

        df["Release date"].notna()

        &

        (
            df["Release date"]
            <= REFERENCE_DATE
        )

    )


    valid_owners = (

        df["Estimated owners"].notna()

        &

        (
            df["Estimated owners"]
            .astype(str)
            .str.strip()
            != "0 - 0"
        )

        &

        df["Popularity Tier"].notna()

    )


    valid_reviews = (

        df["Total Reviews"]
        >= MIN_REVIEWS

    )


    valid_playtime = (

        df["Average playtime forever"]
        .notna()

        &

        (
            df["Average playtime forever"]
            > 0
        )

    )


    valid_era = (

        df["Release Era"]
        .notna()

    )


    final_mask = (

        valid_release

        & valid_owners

        & valid_reviews

        & valid_playtime

        & has_gameplay_genre

        & ~has_software_genre

        & valid_title

        & valid_era

    )


    return (

        df.loc[
            final_mask
        ]
        .copy()

    )


# STRATIFIED SAMPLING

def stratified_sample(
    df: pd.DataFrame
) -> pd.DataFrame:

    sampled_groups = []

    total_size = len(df)


    for tier in POPULARITY_ORDER:

        for era in ERA_ORDER:

            group = df[

                (df["Popularity Tier"] == tier)

                &

                (df["Release Era"] == era)

            ]


            quota = get_sample_quota(
                len(group),
                total_size
            )


            if len(group) < quota:

                raise ValueError(
                    f"Not enough games in stratum "
                    f"{tier}, {era}."
                )


            selected = group.sample(
                n=quota,
                replace=False,
                random_state=RANDOM_SEED
            )


            sampled_groups.append(
                selected
            )


    result = pd.concat(
        sampled_groups,
        ignore_index=True
    )


    result = (

        result.sample(
            frac=1,
            random_state=RANDOM_SEED
        )

        .reset_index(drop=True)

    )


    if len(result) != TARGET_SAMPLE_SIZE:

        raise AssertionError(
            f"Final sample contains "
            f"{len(result)} games instead of "
            f"{TARGET_SAMPLE_SIZE}."
        )


    return result


# VALIDATION

def validate_candidate_pool(
    df: pd.DataFrame
):

    print("\n----------------------------")
    print("CANDIDATE POOL")
    print("----------------------------")

    print(
        f"Candidate games: "
        f"{len(df):,}"
    )


    print("\nStrata:")


    total_size = len(df)


    for tier in POPULARITY_ORDER:

        for era in ERA_ORDER:

            group_size = (

                (
                    (df["Popularity Tier"] == tier)

                    &

                    (df["Release Era"] == era)
                )

                .sum()

            )


            sample_n = get_sample_quota(
                group_size,
                total_size
            )


            print(

                f"{tier:27s} "
                f"{era:10s} "
                f"pool={group_size:4d} "
                f"sample={sample_n:3d}"

            )


# FINAL SAMPLE VALIDATION

def validate_final_sample(
    df: pd.DataFrame
):

    game_dna_columns = [

        "Total Reviews",

        "Positive Ratio",

        "Average playtime forever",

        "Base Price",

        "Release Age Years",

        "Language Count",
    ]


    assert len(df) == TARGET_SAMPLE_SIZE


    assert (

        df["AppID"]
        .duplicated()
        .sum()

        == 0
    )


    assert not (

        df[
            game_dna_columns
        ]

        .isna()

        .any()

        .any()
    )


    assert (

        df["Total Reviews"]
        >= MIN_REVIEWS

    ).all()


    assert (

        df["Average playtime forever"]
        > 0

    ).all()


    assert (

        df["Language Count"]
        > 0

    ).all()


    print("\n----------------------------")
    print("FINAL DATASET")
    print("----------------------------")


    print(
        f"Games: "
        f"{len(df):,}"
    )


    print(
        f"Unique AppIDs: "
        f"{df['AppID'].nunique():,}"
    )


    print(
        "Missing values in "
        "Game DNA dimensions: 0"
    )


    print(
        "\nAS = "
        f"{len(df)} × "
        f"{len(game_dna_columns)} = "
        f"{len(df) * len(game_dna_columns):,}"
    )


    print(
        "\nPopularity:"
    )


    print(

        df["Popularity Tier"]

        .value_counts()

        .reindex(
            POPULARITY_ORDER
        )

    )


    print(
        "\nRelease eras:"
    )


    print(

        df["Release Era"]

        .value_counts()

        .reindex(
            ERA_ORDER
        )

    )


# MAIN PIPELINE

def main():

    parser = argparse.ArgumentParser()


    parser.add_argument(

        "--input",

        type=Path,

        default=Path(
            "data/raw/games.csv"
        )

    )


    parser.add_argument(

        "--output",

        type=Path,

        default=Path(
            "data/processed/"
            "Game_DNA_5000_selected.csv"
        )

    )


    args = parser.parse_args()


    print(
        "GAME DNA — PREPROCESSING PIPELINE"
    )


    print(
        "Reference date:",
        REFERENCE_DATE.date()
    )


    print(
        "Random seed:",
        RANDOM_SEED
    )


    raw = load_raw_dataset(
        args.input
    )


    print(
        "\nRaw games:",
        f"{len(raw):,}"
    )


    featured = create_features(
        raw
    )


    candidates = (

        apply_quality_filter(
            featured
        )

    )


    validate_candidate_pool(
        candidates
    )


    selected = (

        stratified_sample(
            candidates
        )

    )


    validate_final_sample(
        selected
    )


    args.output.parent.mkdir(

        parents=True,

        exist_ok=True

    )


    selected.to_csv(

        args.output,

        index=False

    )


    print(
        "\nSaved:"
    )


    print(
        args.output.resolve()
    )


if __name__ == "__main__":

    main()