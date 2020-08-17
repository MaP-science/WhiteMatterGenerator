import React from "react";
import { Drawer, List, ListItem, ListItemText, ListSubheader } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
import config from "./config";

const drawerWidth = 200;

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex"
    },
    drawer: {
        [theme.breakpoints.up("sm")]: {
            width: drawerWidth,
            flexShrink: 0
        }
    },
    drawerPaper: {
        width: drawerWidth
    },
    content: {
        flexGrow: 1,
        padding: theme.spacing(3)
    },
    nested: {
        paddingLeft: theme.spacing(4)
    }
}));

export default props => {
    const classes = useStyles();
    const history = useHistory();
    return (
        <div className={classes.root}>
            <div className={classes.drawer}>
                <Drawer
                    classes={{
                        paper: classes.drawerPaper
                    }}
                    variant="permanent">
                    <List>
                        {config.map((c, i) =>
                            c.items ? (
                                <List
                                    key={i}
                                    component="div"
                                    disablePadding
                                    subheader={<ListSubheader component="div">{c.title}</ListSubheader>}>
                                    {c.items.map((item, i) => (
                                        <ListItem
                                            key={i}
                                            button
                                            className={classes.nested}
                                            onClick={() =>
                                                history.push(`${process.env.PUBLIC_URL}${c.path}${item.path}`)
                                            }
                                            selected={
                                                props.match.url === `${process.env.PUBLIC_URL}${c.path}${item.path}`
                                            }>
                                            <ListItemText primary={item.title} />
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <ListItem
                                    key={i}
                                    button
                                    onClick={() => history.push(`${process.env.PUBLIC_URL}${c.path}`)}
                                    selected={props.match.url === `${process.env.PUBLIC_URL}${c.path}`}>
                                    <ListItemText primary={c.title} />
                                </ListItem>
                            )
                        )}
                    </List>
                </Drawer>
            </div>
            <div className={classes.content}>{props.children}</div>
        </div>
    );
};
