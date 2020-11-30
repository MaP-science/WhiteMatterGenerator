import React from "react";
import CssBaseline from "@material-ui/core/CssBaseline";
import { BrowserRouter, Switch, Route, Redirect } from "react-router-dom";

import Menu from "./Menu";
import config from "./config";

export default () => (
    <>
        <CssBaseline />
        <BrowserRouter>
            <Route
                path="*"
                component={props => (
                    <Menu {...props}>
                        <Switch>
                            {config.map((c, i) => (
                                <Route key={i} path={`${c.path}`} component={c.component} />
                            ))}
                            <Redirect exact from="*" to={`${config[0].path}`} />
                        </Switch>
                    </Menu>
                )}
            />
        </BrowserRouter>
    </>
);
