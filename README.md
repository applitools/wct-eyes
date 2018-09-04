Applitools Eyes SDK for [web-component-tester](https://github.com/Polymer/tools/tree/master/packages/web-component-tester).

It is currently in alpha version. Please, report all issues and suggestions.

## How to use

1. Install wct-eyes as dependencies (select only one command from the list below, use the same way as you use for `web-component-tester`):
    ```shell
    npm install wct-eyes --save-dev
    ```

    ```shell
    npm install -g wct-eyes
    ```

    ```shell
    bower install wct-eyes
    ```

2. Enable `wct-eyes` plugin
    * Create [wct.conf.json](https://github.com/Polymer/tools/tree/master/packages/web-component-tester#configuration) configuration file and add `eyes` plugin to it:

    ```shell
    {
      "plugins": {
        "eyes": {
          "disabled": false
        }
      }
    }
    ```

    * Or use CLI option to do the same:

    ```shell
    wct --plugin eyes
    ```

    The `wct-eyes` plugin also supports few options like `apiKey`, `serverUrl` and/or `verbose`.
    See [package.json](./package.json) for all possible options and description to them.
