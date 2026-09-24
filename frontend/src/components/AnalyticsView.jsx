import { useMemo } from "react";
import * as d3 from "d3";

function AnalyticsView({
  groupCharacterization,
  gameSimilarity,
}) {
  // Chart layout
  const width = 500;
  const height = 315;

  const margin = {
    top: 38,
    right: 58,
    bottom: 38,
    left: 160,
  };

  const dimensions =
    groupCharacterization?.dimensions ?? [];

  const maxAbsoluteDelta = useMemo(() => {
    if (dimensions.length === 0) {
      return 1;
    }

    const maxValue =
      d3.max(
        dimensions,
        (dimension) =>
          Math.abs(dimension.delta)
      ) ?? 1;

    return Math.max(
      0.25,
      maxValue * 1.15
    );
  }, [dimensions]);

  const xScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([
        -maxAbsoluteDelta,
        maxAbsoluteDelta,
      ])
      .range([
        margin.left,
        width - margin.right,
      ]);
  }, [maxAbsoluteDelta]);

  const yScale = useMemo(() => {
    return d3
      .scaleBand()
      .domain(
        dimensions.map(
          (dimension) =>
            dimension.label
        )
      )
      .range([
        margin.top,
        height - margin.bottom,
      ])
      .padding(0.28);
  }, [dimensions]);

  const positiveColor =
    d3.schemeTableau10[0];

  const negativeColor =
    d3.schemeTableau10[1];

  // Similarity mode
  if (gameSimilarity) {
    return (
      <section className="panel analytics-view">
        <div className="panel-header">
          <div>
            <h2>
              Analytics View
            </h2>

            <p className="panel-description">
              Similar Games
            </p>
          </div>
        </div>

        <div className="similarity-selected-game">
          <span className="similarity-selected-label">
            Selected game
          </span>

          <strong className="similarity-selected-title">
            {
              gameSimilarity
                .selectedGame
                .Name
            }
          </strong>

          <span className="similarity-selected-genre">
            {
              gameSimilarity
                .selectedGame
                .DisplayGenre
            }
          </span>
        </div>

        <p className="similarity-intro">
          Closest Game DNA profiles in the complete
          six-dimensional standardized space.
        </p>

        <div className="similarity-list">
          {gameSimilarity
            .similarGames
            .map(
              (
                result,
                index
              ) => (
                <div
                  className="similarity-item"
                  key={
                    result.game.AppID
                  }
                >
                  <div className="similarity-rank">
                    {index + 1}
                  </div>

                  <div className="similarity-game-info">
                    <strong>
                      {result.game.Name}
                    </strong>

                    <span>
                      {
                        result.game
                          .DisplayGenre
                      }
                    </span>
                  </div>

                  <div className="similarity-distance">
                    <span>
                      Distance
                    </span>

                    <strong>
                      {
                        result.distance
                          .toFixed(3)
                      }
                    </strong>
                  </div>
                </div>
              )
            )}
        </div>

        <p className="analytics-note">
          Smaller Euclidean distance means a more similar
          market profile across the six standardized
          Game DNA dimensions.
        </p>
      </section>
    );
  }

  // Empty state
  if (!groupCharacterization) {
    return (
      <section className="panel analytics-view">
        <div className="panel-header">
          <div>
            <h2>
              Analytics View
            </h2>

            <p className="panel-description">
              Interactive Analytics
            </p>
          </div>
        </div>

        <div className="analytics-empty-state">
          <strong>
            No analytical selection
          </strong>

          <span>
            Select a market region to characterize a group,
            or click a game to find similar Game DNA profiles.
          </span>
        </div>
      </section>
    );
  }

  // Group characterization
  return (
    <section className="panel analytics-view">
      <div className="panel-header">
        <div>
          <h2>
            Analytics View
          </h2>

          <p className="panel-description">
            Group Characterization
          </p>
        </div>
      </div>

      <div className="analytics-summary">
        <div className="analytics-summary-main">
          <strong>
            {
              groupCharacterization
                .selectedCount
                .toLocaleString()
            }
          </strong>

          <span>
            selected
          </span>

          <span className="analytics-summary-separator">
            vs
          </span>

          <strong>
            {
              groupCharacterization
                .restCount
                .toLocaleString()
            }
          </strong>

          <span>
            rest of market
          </span>
        </div>

        <div className="analytics-source">
          Source:{" "}

          <strong>
            {
              groupCharacterization
                .sourceLabel
            }
          </strong>
        </div>
      </div>

      <div className="group-characterization-chart">
        <svg
          viewBox={
            `0 0 ${width} ${height}`
          }
          className="analytics-svg"
        >
          <text
            x={
              xScale(
                -maxAbsoluteDelta
              )
            }
            y={18}
            textAnchor="start"
            className="analytics-direction-label"
          >
            Lower
          </text>

          <text
            x={
              xScale(
                maxAbsoluteDelta
              )
            }
            y={18}
            textAnchor="end"
            className="analytics-direction-label"
          >
            Higher
          </text>

          <line
            x1={xScale(0)}
            x2={xScale(0)}
            y1={margin.top - 8}
            y2={
              height -
              margin.bottom +
              5
            }
            className="analytics-zero-line"
          />

          <text
            x={xScale(0)}
            y={height - 8}
            textAnchor="middle"
            className="analytics-zero-label"
          >
            0
          </text>

          {dimensions.map(
            (dimension) => {
              const delta =
                dimension.delta;

              const y =
                yScale(
                  dimension.label
                );

              const barHeight =
                yScale.bandwidth();

              const zeroX =
                xScale(0);

              const valueX =
                xScale(delta);

              const barX =
                Math.min(
                  zeroX,
                  valueX
                );

              const barWidth =
                Math.abs(
                  valueX - zeroX
                );

              const color =
                delta >= 0
                  ? positiveColor
                  : negativeColor;

              /*
               * Large negative bars can reach the label area.
               * In that case the value is placed inside the bar.
               */
              const negativeValueInside =
                delta < 0 &&
                valueX <
                  margin.left + 48;

              let valueLabelX;
              let valueLabelAnchor;

              if (delta >= 0) {
                valueLabelX =
                  valueX + 6;

                valueLabelAnchor =
                  "start";
              } else if (
                negativeValueInside
              ) {
                valueLabelX =
                  valueX + 6;

                valueLabelAnchor =
                  "start";
              } else {
                valueLabelX =
                  valueX - 6;

                valueLabelAnchor =
                  "end";
              }

              return (
                <g
                  key={
                    dimension.key
                  }
                >
                  <text
                    x={
                      margin.left - 10
                    }
                    y={
                      y +
                      barHeight / 2
                    }
                    dy="0.35em"
                    textAnchor="end"
                    className="analytics-dimension-label"
                  >
                    {dimension.label}
                  </text>

                  <rect
                    x={barX}
                    y={y}
                    width={
                      Math.max(
                        barWidth,
                        1
                      )
                    }
                    height={
                      barHeight
                    }
                    fill={color}
                    className="analytics-bar"
                  >
                    <title>
                      {`${dimension.label}
Selected mean: ${dimension.selectedMean.toFixed(3)}
Rest mean: ${dimension.restMean.toFixed(3)}
Difference: ${dimension.delta >= 0 ? "+" : ""}${dimension.delta.toFixed(3)}`}
                    </title>
                  </rect>

                  <text
                    x={
                      valueLabelX
                    }
                    y={
                      y +
                      barHeight / 2
                    }
                    dy="0.35em"
                    textAnchor={
                      valueLabelAnchor
                    }
                    className="analytics-value-label"
                    fill={
                      negativeValueInside
                        ? "#111"
                        : undefined
                    }
                  >
                    {
                      delta >= 0
                        ? "+"
                        : ""
                    }

                    {
                      delta.toFixed(2)
                    }
                  </text>
                </g>
              );
            }
          )}
        </svg>
      </div>

      <div className="analytics-legend">
        <div className="analytics-legend-item">
          <span
            className="analytics-legend-dot"
            style={{
              backgroundColor:
                positiveColor,
            }}
          />

          <span>
            Higher in selected group
          </span>
        </div>

        <div className="analytics-legend-item">
          <span
            className="analytics-legend-dot"
            style={{
              backgroundColor:
                negativeColor,
            }}
          />

          <span>
            Lower in selected group
          </span>
        </div>
      </div>

      <p className="analytics-note">
        Values represent differences between standardized
        group means and the rest of the 5,000-game market.
      </p>
    </section>
  );
}

export default AnalyticsView;