import React from "react";
import { ContinuousColorLegend } from "react-vis";
import "../../node_modules/react-vis/dist/style.css";

export default props => (
    <ContinuousColorLegend
        width={props.width}
        startTitle={props.min.toFixed(2) + " µm"}
        midTitle={((props.min + props.max) / 2).toFixed(2) + " µm"}
        endTitle={props.max.toFixed(2) + " µm"}
        orientation="vertical"
        startColor="red"
        endColor="blue"
    />
);
