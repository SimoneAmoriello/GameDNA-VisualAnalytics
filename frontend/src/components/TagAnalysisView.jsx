import {
  useMemo,
} from "react";

import * as d3 from "d3";


function TagAnalysisView({
  tagEnrichment,
}) {

  // -------------------------------------------------------
  // Chart dimensions
  // -------------------------------------------------------

  const width = 500;
  const height = 320;

  const margin = {
    top: 38,
    right: 65,
    bottom: 35,
    left: 145,
  };


  // -------------------------------------------------------
  // Colors
  // -------------------------------------------------------

  const positiveColor =
    d3.schemeTableau10[0];

  const negativeColor =
    d3.schemeTableau10[1];


  // -------------------------------------------------------
  // Tags shown in the chart
  // -------------------------------------------------------
  //
  // We show:
  //
  // - 5 most enriched tags
  // - 5 most depleted tags
  //
  // This keeps the visualization readable while still
  // showing both directions of the comparison.
  // -------------------------------------------------------

  const displayedTags =
    useMemo(() => {

      if (
        !tagEnrichment ||
        tagEnrichment.status !==
          "ready"
      ) {

        return [];

      }


      const enriched =
        tagEnrichment
          .tags
          .filter(
            (result) =>
              result.enrichmentPP >
              0
          )
          .slice(
            0,
            5
          );


      const depleted =
        tagEnrichment
          .tags
          .filter(
            (result) =>
              result.enrichmentPP <
              0
          )
          .sort(
            (a, b) =>
              a.enrichmentPP -
              b.enrichmentPP
          )
          .slice(
            0,
            5
          );


      return [
        ...enriched,
        ...depleted,
      ];

    }, [
      tagEnrichment,
    ]);


  // -------------------------------------------------------
  // Symmetric X domain
  // -------------------------------------------------------

  const maxAbsoluteEnrichment =
    useMemo(() => {

      if (
        displayedTags.length === 0
      ) {

        return 10;

      }


      const maxValue =
        d3.max(
          displayedTags,
          (result) =>
            Math.abs(
              result.enrichmentPP
            )
        ) ?? 10;


      // Minimum range prevents tiny differences
      // from visually appearing extremely large.
      return Math.max(
        5,
        maxValue * 1.15
      );

    }, [
      displayedTags,
    ]);


  // -------------------------------------------------------
  // X scale
  // -------------------------------------------------------

  const xScale =
    useMemo(() => {

      return d3
        .scaleLinear()
        .domain([
          -maxAbsoluteEnrichment,
          maxAbsoluteEnrichment,
        ])
        .range([
          margin.left,
          width - margin.right,
        ]);

    }, [
      maxAbsoluteEnrichment,
    ]);


  // -------------------------------------------------------
  // Y scale
  // -------------------------------------------------------

  const yScale =
    useMemo(() => {

      return d3
        .scaleBand()
        .domain(
          displayedTags.map(
            (result) =>
              result.tag
          )
        )
        .range([
          margin.top,
          height - margin.bottom,
        ])
        .padding(0.24);

    }, [
      displayedTags,
    ]);


  // =======================================================
  // EMPTY STATE
  // =======================================================

  if (
    !tagEnrichment
  ) {

    return (

      <section className="panel tag-analysis-view">

        <div className="panel-header">

          <div>

            <h2>
              Tag Analysis View
            </h2>

            <p className="panel-description">
              Tag Enrichment
            </p>

          </div>

        </div>


        <div className="tag-empty-state">

          <strong>
            No group selected
          </strong>

          <span>
            Select a market region to discover which Steam
            tags are more or less common than in the rest
            of the market.
          </span>

        </div>

      </section>

    );

  }


  // =======================================================
  // GROUP TOO SMALL
  // =======================================================

  if (
    tagEnrichment.status ===
    "too-small"
  ) {

    return (

      <section className="panel tag-analysis-view">

        <div className="panel-header">

          <div>

            <h2>
              Tag Analysis View
            </h2>

            <p className="panel-description">
              Tag Enrichment
            </p>

          </div>

        </div>


        <div className="tag-empty-state">

          <strong>
            Selection too small
          </strong>

          <span>

            Tag Enrichment requires at least{" "}
            {tagEnrichment.minimumSize} games.

            {" "}The current selection contains{" "}
            {tagEnrichment.selectedCount}.

          </span>

        </div>

      </section>

    );

  }


  // =======================================================
  // READY STATE
  // =======================================================

  return (

    <section className="panel tag-analysis-view">

      {/* ---------------------------------------------------
          Header
          --------------------------------------------------- */}

      <div className="panel-header">

        <div>

          <h2>
            Tag Analysis View
          </h2>

          <p className="panel-description">
            Tag Enrichment
          </p>

        </div>

      </div>


      {/* ---------------------------------------------------
          Selection summary
          --------------------------------------------------- */}

      <div className="tag-summary">

        <div className="tag-summary-main">

          <strong>
            {tagEnrichment
              .selectedCount
              .toLocaleString()}
          </strong>

          <span>
            selected
          </span>


          <span className="tag-summary-separator">
            vs
          </span>


          <strong>
            {tagEnrichment
              .restCount
              .toLocaleString()}
          </strong>

          <span>
            rest of market
          </span>

        </div>


        <div className="tag-source">

          Source:{" "}

          <strong>
            {tagEnrichment
              .sourceLabel}
          </strong>

        </div>

      </div>


      {/* ---------------------------------------------------
          Diverging bar chart
          --------------------------------------------------- */}

      <div className="tag-chart">

        <svg
          viewBox={
            `0 0 ${width} ${height}`
          }

          className="tag-svg"
        >

          {/* Direction labels */}
          <text
            x={
              xScale(
                -maxAbsoluteEnrichment
              )
            }

            y={18}

            textAnchor="start"

            className="tag-direction-label"
          >

            Less common

          </text>


          <text
            x={
              xScale(
                maxAbsoluteEnrichment
              )
            }

            y={18}

            textAnchor="end"

            className="tag-direction-label"
          >

            More common

          </text>


          {/* Zero reference line */}
          <line
            x1={
              xScale(0)
            }

            x2={
              xScale(0)
            }

            y1={
              margin.top - 8
            }

            y2={
              height -
              margin.bottom +
              5
            }

            className="tag-zero-line"
          />


          {/* Zero label */}
          <text
            x={
              xScale(0)
            }

            y={
              height - 8
            }

            textAnchor="middle"

            className="tag-zero-label"
          >

            0

          </text>


          {/* ------------------------------------------------
              Tag bars
              ------------------------------------------------ */}

          {displayedTags.map(
            (result) => {

              const value =
                result.enrichmentPP;


              const y =
                yScale(
                  result.tag
                );


              const barHeight =
                yScale.bandwidth();


              const zeroX =
                xScale(0);


              const valueX =
                xScale(
                  value
                );


              const barX =
                Math.min(
                  zeroX,
                  valueX
                );


              const barWidth =
                Math.abs(
                  valueX -
                  zeroX
                );


              const color =
                value >= 0
                  ? positiveColor
                  : negativeColor;


              return (

                <g
                  key={
                    result.tag
                  }
                >

                  {/* Tag label */}
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

                    className="tag-label"
                  >

                    {result.tag}

                  </text>


                  {/* Bar */}
                  <rect
                    x={
                      barX
                    }

                    y={
                      y
                    }

                    width={
                      Math.max(
                        barWidth,
                        1
                      )
                    }

                    height={
                      barHeight
                    }

                    fill={
                      color
                    }

                    className="tag-bar"
                  >

                    <title>

                      {`${result.tag}
Selected: ${(result.selectedPrevalence * 100).toFixed(1)}%
Rest: ${(result.restPrevalence * 100).toFixed(1)}%
Difference: ${result.enrichmentPP >= 0 ? "+" : ""}${result.enrichmentPP.toFixed(1)} pp`}

                    </title>

                  </rect>


                  {/* Value label */}
                  <text
                    x={
                      value >= 0

                        ? valueX + 6

                        : valueX - 6
                    }

                    y={
                      y +
                      barHeight / 2
                    }

                    dy="0.35em"

                    textAnchor={
                      value >= 0
                        ? "start"
                        : "end"
                    }

                    className="tag-value-label"
                  >

                    {value >= 0
                      ? "+"
                      : ""}

                    {value.toFixed(1)} pp

                  </text>

                </g>

              );

            }
          )}

        </svg>

      </div>


      {/* ---------------------------------------------------
          Legend
          --------------------------------------------------- */}

      <div className="tag-legend">

        <div className="tag-legend-item">

          <span
            className="tag-legend-dot"

            style={{
              backgroundColor:
                positiveColor,
            }}
          />

          <span>
            More common in selected group
          </span>

        </div>


        <div className="tag-legend-item">

          <span
            className="tag-legend-dot"

            style={{
              backgroundColor:
                negativeColor,
            }}
          />

          <span>
            Less common in selected group
          </span>

        </div>

      </div>


      {/* ---------------------------------------------------
          Explanation
          --------------------------------------------------- */}

      <p className="tag-note">

        Values show the difference in tag prevalence
        between the selected group and the rest of the
        5,000-game market. pp = percentage points.

      </p>

    </section>

  );

}


export default TagAnalysisView;