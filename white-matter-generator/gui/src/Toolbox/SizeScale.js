import React from "react";
import Legend from "./Legend";
import "../../node_modules/react-vis/dist/style.css";
import { helperFunctions } from "@white-matter-generator/core";

export default props => {
    const n = 100;
    const colors = Array(n)
        .fill(true)
        .map((_, i) => "#" + helperFunctions.scaledValueToColor(i / (n - 1)).getHexString());
    return (
        <Legend
            width={props.width}
            startTitle={props.min.toFixed(2) + " µm"}
            midTitle={((props.min + props.max) / 2).toFixed(2) + " µm"}
            endTitle={props.max.toFixed(2) + " µm"}
            orientation="vertical"
            colors={colors}
        />
    );
};
