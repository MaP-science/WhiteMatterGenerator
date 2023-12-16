import React from "react";

const Code = props => (
    <pre
        style={{
            fontFamily: "courier new",
            color: "crimson",
            backgroundColor: "#f1f1f1",
            padding: "2px",
            fontSize: "105%"
        }}>
        {props.children}
    </pre>
);

export default () => (
    <>
        <b>CLI (command-line interface) - Installation guide</b>
        <p>
            If you haven't already, you need to install npm. This can be done by running the following commands in a
            terminal:
        </p>
        <Code>curl -sL https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh -o install_nvm.sh</Code>
        <Code>bash install_nvm.sh</Code>
        <Code>nvm install --lts</Code>
        <p>Then you should be able to install the CLI by running the command:</p>
        <Code>npm i -g white-matter-generator</Code>
        <p>Now, you can run the CLI using the command:</p>
        <Code>white-matter-generator</Code>
    </>
);
