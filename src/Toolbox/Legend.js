import React from "react";

export default ({ colors, startTitle, midTitle, endTitle, height, width }) => (
    <div className={"rv-continuous-color-legend"} style={{ width, height }}>
        <div className="rv-gradient" style={{ background: `linear-gradient(to right, ${colors.join(",")})` }} />
        <div className="rv-legend-titles">
            <span className="rv-legend-titles__left">{startTitle}</span>
            <span className="rv-legend-titles__right">{endTitle}</span>
            {midTitle ? <span className="rv-legend-titles__center">{midTitle}</span> : null}
        </div>
    </div>
);
