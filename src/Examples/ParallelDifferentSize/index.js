import React from "react";
import {
    Typography,
    Paper,
    makeStyles,
    TextField,
    Button,
    List,
    ListItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    FormControl,
    InputLabel,
    InputAdornment,
    Select,
    MenuItem
} from "@material-ui/core";
import { save } from "save-file";
import config from "./config";
import imgEllipsoids from "./ellipsoids.png";
import imgPipesSide from "./pipesSide.png";
import imgPipesFront from "./pipesFront.png";

const useStyles = makeStyles(theme => ({
    img: {
        width: 400
    }
}));

export default props => {
    const classes = useStyles();
    return (
        <>
            <Typography>The following config file will be used in this example:</Typography>
            <Button
                variant="contained"
                onClick={() => {
                    save(JSON.stringify(config, null, 4), "config.json");
                }}>
                Config file
            </Button>
            <Typography>
                Using this file and setting the volume fraction target to 80%, the following result is obtained:
            </Typography>
            <img src={imgEllipsoids} className={classes.img} />
            <Typography>Switching to the pipe display mode the result is:</Typography>
            <img src={imgPipesSide} className={classes.img} />
            <Typography>and</Typography>
            <img src={imgPipesFront} className={classes.img} />
        </>
    );
};
