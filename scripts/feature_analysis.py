import pandas as pd
from pathlib import Path


INPUT_PATH = Path(
    "data/processed/Game_DNA_5000_selected.csv"
)


GAME_DNA_COLUMNS = [
    "Total Reviews",
    "Positive Ratio",
    "Average playtime forever",
    "Base Price",
    "Release Age Years",
    "Language Count",
]


def main():

    df = pd.read_csv(
        INPUT_PATH,
        low_memory=False
    )


    print("GAME DNA — FEATURE ANALYSIS")
    print("----------------------------")

    print(
        f"Games: {len(df):,}"
    )

    print(
        f"Dimensions: {len(GAME_DNA_COLUMNS)}"
    )


    print("\nDESCRIPTIVE STATISTICS")
    print("----------------------------")

    statistics = (
        df[GAME_DNA_COLUMNS]
        .describe(
            percentiles=[
                0.25,
                0.50,
                0.75,
                0.90,
                0.95,
                0.99
            ]
        )
        .T
    )

    print(
        statistics.to_string()
    )


    print("\nSKEWNESS")
    print("----------------------------")

    skewness = (
        df[GAME_DNA_COLUMNS]
        .skew()
        .sort_values(
            ascending=False
        )
    )

    print(skewness)


    print("\nZERO VALUES")
    print("----------------------------")

    zero_counts = (
        df[GAME_DNA_COLUMNS]
        .eq(0)
        .sum()
    )

    print(zero_counts)


    print("\nMISSING VALUES")
    print("----------------------------")

    missing_counts = (
        df[GAME_DNA_COLUMNS]
        .isna()
        .sum()
    )

    print(missing_counts)


if __name__ == "__main__":

    main()