import ast
import pandas as pd

from pathlib import Path


SELECTED_PATH = Path(
    "data/processed/Game_DNA_5000_selected.csv"
)

STANDARDIZED_PATH = Path(
    "data/processed/Game_DNA_5000_standardized.csv"
)

PCA_PATH = Path(
    "data/processed/Game_DNA_5000_pca.csv"
)

OUTPUT_PATH = Path(
    "data/app/Game_DNA_5000_app.json"
)


RAW_GAME_DNA_COLUMNS = [
    "Total Reviews",
    "Positive Ratio",
    "Average playtime forever",
    "Base Price",
    "Release Age Years",
    "Language Count",
]


STANDARDIZED_COLUMNS = [
    "Popularity_Z",
    "Appreciation_Z",
    "Engagement_Z",
    "Commercial_Position_Z",
    "Maturity_Z",
    "Market_Reach_Z",
]


CONTEXT_COLUMNS = [
    "AppID",
    "Name",
    "Release date",
    "Estimated owners",
    "Peak CCU",
    "Developers",
    "Publishers",
    "Genres",
    "Tags",
]


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


RENAME_COLUMNS = {
    "Release date": "ReleaseDate",
    "Estimated owners": "EstimatedOwners",
    "Peak CCU": "PeakCCU",

    "Total Reviews": "Popularity",
    "Positive Ratio": "Appreciation",
    "Average playtime forever": "Engagement",
    "Base Price": "CommercialPosition",
    "Release Age Years": "Maturity",
    "Language Count": "MarketReach",
}


def parse_collection(value):

    if pd.isna(value):
        return []

    if isinstance(value, (list, tuple, set)):
        return [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]

    if isinstance(value, dict):
        return [
            str(key).strip()
            for key in value.keys()
            if str(key).strip()
        ]

    text = str(value).strip()

    if not text:
        return []

    try:
        parsed = ast.literal_eval(text)

        if isinstance(parsed, dict):
            return [
                str(key).strip()
                for key in parsed.keys()
                if str(key).strip()
            ]

        if isinstance(parsed, (list, tuple, set)):
            return [
                str(item).strip()
                for item in parsed
                if str(item).strip()
            ]

    except (ValueError, SyntaxError):
        pass

    return [
        item.strip()
        for item in text.split(",")
        if item.strip()
    ]


DISPLAY_GENRES = {
    "Action",
    "Adventure",
    "Casual",
    "Simulation",
    "RPG",
    "Strategy",
}


def get_display_genre(genres):

    for genre in genres:

        if genre in DISPLAY_GENRES:
            return genre

    return "Other"


def validate_app_data(df):

    if len(df) != 5000:
        raise ValueError(
            f"Expected 5,000 games, found {len(df):,}."
        )

    if df["AppID"].nunique() != 5000:
        raise ValueError(
            "AppID values are not unique."
        )

    analytical_columns = [
        "Popularity",
        "Appreciation",
        "Engagement",
        "CommercialPosition",
        "Maturity",
        "MarketReach",
        *STANDARDIZED_COLUMNS,
        "PC1",
        "PC2",
    ]

    missing = (
        df[analytical_columns]
        .isna()
        .sum()
        .sum()
    )

    if missing != 0:
        raise ValueError(
            f"Found {missing} missing analytical values."
        )

    if df["Name"].isna().any():
        raise ValueError(
            "Missing game names found."
        )


def main():

    print("GAME DNA — APP DATA")
    print("----------------------------")


    selected = pd.read_csv(
        SELECTED_PATH,
        low_memory=False
    )

    standardized = pd.read_csv(
        STANDARDIZED_PATH,
        low_memory=False
    )

    pca = pd.read_csv(
        PCA_PATH,
        low_memory=False
    )


    print(
        f"Selected dataset: {len(selected):,}"
    )

    print(
        f"Standardized dataset: {len(standardized):,}"
    )

    print(
        f"PCA dataset: {len(pca):,}"
    )


    selected_ids = set(
        selected["AppID"]
    )

    standardized_ids = set(
        standardized["AppID"]
    )

    pca_ids = set(
        pca["AppID"]
    )


    if not (
        selected_ids
        == standardized_ids
        == pca_ids
    ):
        raise ValueError(
            "AppID sets do not match across input datasets."
        )


    base = selected[
        CONTEXT_COLUMNS
        + RAW_GAME_DNA_COLUMNS
    ].copy()


    standardized_data = standardized[
        ["AppID"]
        + STANDARDIZED_COLUMNS
    ].copy()


    pca_data = pca[
        [
            "AppID",
            "PC1",
            "PC2",
        ]
    ].copy()


    app_data = base.merge(
        standardized_data,
        on="AppID",
        how="inner",
        validate="one_to_one"
    )


    app_data = app_data.merge(
        pca_data,
        on="AppID",
        how="inner",
        validate="one_to_one"
    )


    app_data = app_data.rename(
        columns=RENAME_COLUMNS
    )


    app_data["Genres"] = (
        app_data["Genres"]
        .apply(parse_collection)
    )

    app_data["Tags"] = (
        app_data["Tags"]
        .apply(parse_collection)
    )


    app_data["DisplayGenre"] = (
        app_data["Genres"]
        .apply(get_display_genre)
    )


    validate_app_data(
        app_data
    )


    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    app_data.to_json(
        OUTPUT_PATH,
        orient="records",
        force_ascii=False
    )


    all_tags = {
        tag
        for tags in app_data["Tags"]
        for tag in tags
    }


    print("\nAPP DATA VALIDATION")
    print("----------------------------")

    print(
        f"Games: {len(app_data):,}"
    )

    print(
        f"Unique AppIDs: "
        f"{app_data['AppID'].nunique():,}"
    )

    print(
        f"Unique tags: {len(all_tags):,}"
    )

    print(
        "Missing analytical values: 0"
    )


    print("\nDISPLAY GENRE DISTRIBUTION")
    print("----------------------------")

    print(
        app_data["DisplayGenre"]
        .value_counts()
        .to_string()
    )


    print("\nFINAL COLUMNS")
    print("----------------------------")

    for column in app_data.columns:
        print(column)


    print("\nSaved:")
    print(
        OUTPUT_PATH.resolve()
    )


if __name__ == "__main__":

    main()