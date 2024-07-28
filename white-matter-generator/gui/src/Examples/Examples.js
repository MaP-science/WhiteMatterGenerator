import React from "react";
import { Switch, Route } from "react-router-dom";

import config from "./config";

export default props => (
    <Switch>
        {config.items.map((item, i) => (
            <Route key={i} path={`${props.match.path}${item.path}`} component={item.component} />
        ))}
    </Switch>
);
