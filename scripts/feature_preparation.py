import numpy as np
import pandas as pd

from pathlib import Path
from sklearn.preprocessing import StandardScaler


INPUT_PATH = Path(
    "data/processed/Game_DNA_5000_selected.csv"
)

OUTPUT_PATH = Path(
    "data/processed/Game_DNA_5000_standardized.csv"
)


GAME_DNA_COLUMNS = [
    "Total Reviews",
    "Positive Ratio",
    "Average playtime forever",
    "Base Price",
    "Release Age Years",
    "Language Count",
]


LOG_COLUMNS = [
    "Total Reviews",
    "Average playtime forever",
    "Base Price",
    "Language Count",
]


STANDARDIZED_NAMES = {
    "Total Reviews": "Popularity_Z",
    "Positive Ratio": "Appreciation_Z",
    "Average playtime forever": "Engagement_Z",
    "Base Price": "Commercial_Position_Z",
    "Release Age Years": "Maturity_Z",
    "Language Count": "Market_Reach_Z",
}


def main():

    df = pd.read_csv(
        INPUT_PATH,
        low_memory=False
    )


    print("GAME DNA — FEATURE PREPARATION")
    print("----------------------------")

    print(
        f"Games: {len(df):,}"
    )

    print(
        f"Dimensions: {len(GAME_DNA_COLUMNS)}"
    )


    original_skewness = (
        df[GAME_DNA_COLUMNS]
        .skew()
    )


    transformed = (
        df[GAME_DNA_COLUMNS]
        .copy()
    )


    for column in LOG_COLUMNS:

        if (transformed[column] < 0).any():

            raise ValueError(
                f"{column} contains negative values."
            )

        transformed[column] = np.log1p(
            transformed[column]
        )


    transformed_skewness = (
        transformed
        .skew()
    )


    print("\nSKEWNESS COMPARISON")
    print("----------------------------")

    comparison = pd.DataFrame({
        "Original": original_skewness,
        "Transformed": transformed_skewness
    })

    print(
        comparison.to_string()
    )


    if transformed.isna().any().any():

        raise ValueError(
            "Missing values found after transformation."
        )


    scaler = StandardScaler()

    standardized_values = (
        scaler.fit_transform(
            transformed
        )
    )


    standardized = pd.DataFrame(
        standardized_values,
        columns=GAME_DNA_COLUMNS,
        index=df.index
    )


    standardized = (
        standardized
        .rename(
            columns=STANDARDIZED_NAMES
        )
    )


    print("\nSTANDARDIZED STATISTICS")
    print("----------------------------")

    validation = pd.DataFrame({
        "Mean": standardized.mean(),
        "Std": standardized.std(ddof=0),
        "Min": standardized.min(),
        "Max": standardized.max()
    })

    print(
        validation.to_string()
    )


    if standardized.isna().any().any():

        raise ValueError(
            "Missing values found after standardization."
        )


    prepared = standardized.copy()

    prepared.insert(
        0,
        "AppID",
        df["AppID"].values
    )


    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    prepared.to_csv(
        OUTPUT_PATH,
        index=False
    )


    print("\nFINAL ANALYTICAL MATRIX")
    print("----------------------------")

    print(
        f"Games: {len(prepared):,}"
    )

    print(
        f"Analytical dimensions: "
        f"{len(STANDARDIZED_NAMES)}"
    )

    print(
        "Missing values: "
        f"{prepared.isna().sum().sum()}"
    )


    print("\nSaved:")
    print(
        OUTPUT_PATH.resolve()
    )


if __name__ == "__main__":

    main()