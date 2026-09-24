import numpy as np
import pandas as pd

from pathlib import Path
from sklearn.decomposition import PCA


INPUT_PATH = Path(
    "data/processed/Game_DNA_5000_standardized.csv"
)

SCORES_OUTPUT_PATH = Path(
    "data/processed/Game_DNA_5000_pca.csv"
)

LOADINGS_OUTPUT_PATH = Path(
    "data/processed/PCA_loadings.csv"
)

VARIANCE_OUTPUT_PATH = Path(
    "data/processed/PCA_explained_variance.csv"
)


FEATURE_COLUMNS = [
    "Popularity_Z",
    "Appreciation_Z",
    "Engagement_Z",
    "Commercial_Position_Z",
    "Maturity_Z",
    "Market_Reach_Z",
]


def main():

    df = pd.read_csv(
        INPUT_PATH,
        low_memory=False
    )


    print("GAME DNA — PCA")
    print("----------------------------")

    print(
        f"Games: {len(df):,}"
    )

    print(
        f"Input dimensions: "
        f"{len(FEATURE_COLUMNS)}"
    )


    features = (
        df[FEATURE_COLUMNS]
        .copy()
    )


    if features.isna().any().any():

        raise ValueError(
            "Missing values found in PCA input."
        )


    pca = PCA(
        n_components=len(FEATURE_COLUMNS)
    )


    scores = pca.fit_transform(
        features
    )


    component_names = [
        f"PC{i}"
        for i in range(
            1,
            len(FEATURE_COLUMNS) + 1
        )
    ]


    explained_variance = pd.DataFrame({
        "Component": component_names,
        "Explained_Variance": (
            pca.explained_variance_ratio_
        ),
        "Explained_Variance_Percent": (
            pca.explained_variance_ratio_
            * 100
        ),
        "Cumulative_Variance_Percent": (
            np.cumsum(
                pca.explained_variance_ratio_
            )
            * 100
        )
    })


    print("\nEXPLAINED VARIANCE")
    print("----------------------------")

    print(
        explained_variance.to_string(
            index=False,
            formatters={
                "Explained_Variance":
                    "{:.4f}".format,
                "Explained_Variance_Percent":
                    "{:.2f}".format,
                "Cumulative_Variance_Percent":
                    "{:.2f}".format,
            }
        )
    )


    loadings_values = (
        pca.components_.T
        * np.sqrt(
            pca.explained_variance_
        )
    )


    loadings = pd.DataFrame(
        loadings_values,
        index=FEATURE_COLUMNS,
        columns=component_names
    )


    print("\nPCA LOADINGS")
    print("----------------------------")

    print(
        loadings.to_string(
            float_format=lambda x: f"{x:.4f}"
        )
    )


    pca_scores = pd.DataFrame(
        scores,
        columns=component_names,
        index=df.index
    )


    pca_scores.insert(
        0,
        "AppID",
        df["AppID"].values
    )


    if pca_scores.isna().any().any():

        raise ValueError(
            "Missing values found in PCA scores."
        )


    SCORES_OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    pca_scores.to_csv(
        SCORES_OUTPUT_PATH,
        index=False
    )


    loadings.reset_index(
        names="Feature"
    ).to_csv(
        LOADINGS_OUTPUT_PATH,
        index=False
    )


    explained_variance.to_csv(
        VARIANCE_OUTPUT_PATH,
        index=False
    )


    print("\nPCA OUTPUT")
    print("----------------------------")

    print(
        f"Games: {len(pca_scores):,}"
    )

    print(
        f"Principal components: "
        f"{len(component_names)}"
    )

    print(
        f"Missing values: "
        f"{pca_scores.isna().sum().sum()}"
    )


    print("\nSaved:")

    print(
        SCORES_OUTPUT_PATH.resolve()
    )

    print(
        LOADINGS_OUTPUT_PATH.resolve()
    )

    print(
        VARIANCE_OUTPUT_PATH.resolve()
    )


if __name__ == "__main__":

    main()