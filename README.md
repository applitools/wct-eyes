Applitools Eyes SDK for [web-component-tester](https://github.com/Polymer/tools/tree/master/packages/web-component-tester).

It is currently in alpha version. Please, report all issues and suggestions.

## Installation

1. Install wct-eyes as dependencies (select only one command from the list below, use the same way as you use for `web-component-tester`):
    ```shell
    npm install wct-eyes --save-dev
    ```

    ```shell
    npm install -g wct-eyes
    ```

<!---
    ```shell
    bower install wct-eyes
    ```
--->

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

## How to use

After you installed `wct-eyes` plugin you can start using it.

If you just starting using Applitools Eyes, then you need to register an account and obtain api key. When you get the api key, you should set it to environment variables as `APPLITOOLS_API_KEY` or use plugin option `apiKey` (put it after `"disabled": false` of the example above in `wct.conf.json`).

There is example of simple WCT test for fixture
```html
<test-fixture id="simple">
    <template>
        <p>Hello world!</p>
    </template>
</test-fixture>

<script>
    suite('helloWorldTest', () => {
        let simple;

        setup(() => {
            simple = fixture('simple');
        });

        test('text should be equal given', () => {
            assert.equal(simple.textContent, 'Hello world!');
        });
    });
</script>
 ```
 
 Using Applitools `wct-eyes` you can do visual validation of content. Let's update out example
 ```html
<test-fixture id="simple">
    <template>
      <p>Hello world!</p>
    </template>
  </test-fixture>

  <script>
    suite('helloWorldTest', function() { // check that you are using function and not () =>, because `this` is not available when you are using arrows
      this.timeout(60000); // we need to increase timeout, because we need some more time for visual validation

      let simple, eyes; // add eyes variable
      suiteSetup(function() {
        eyes = new (typeof Eyes !== 'undefined' ? Eyes : parent.Eyes)(); // create an Eyes instance using local Eyes or parent.Eyes class
      });

      setup(function() {
        simple = fixture('simple');
        return eyes.open(this.test.parent.title, this.currentTest.title); // open Eyes session, use suite name as application name and test name as test name
      });

      test('text should be equal given', function() {
        assert.equal(simple.textContent, 'Hello world!');

        eyes.checkWindow('Hello world text'); // match current viewport
        // this method returns a promise, so it should be returned
        return eyes.close(); // close matching, get match results
      });

      test('text should be changed and validated', function(done) {
        simple.textContent = simple.textContent + ' I\'m visual test example.';
        assert.equal(simple.textContent, 'Hello world! I\'m visual test example.');

        eyes.checkWindow('Hello world text +');
        eyes.close();

        eyes.whenDone(done); // this method can be used instead of returning promise, you can use callback function
      });

      teardown(function () {
        return eyes.abortIfNotClosed(); // used to close session if an error occurred in a test
      });
    });
  </script>
  ```
  
The results should looks like this
```
[EYES: TEST RESULTS]:
[Chrome] Test 'text should be equal given' of 'helloWorldTest' is a new test, please, approve baseline!
[Chrome] Test 'text should be changed and validated' of 'helloWorldTest' is a new test, please, approve baseline!
See details at https://eyes.applitools.com/app/test-results/00000251865619809217?accountId=SDiQx0yNxEaxwg5rGNSP7A~~
```

You can follow the link from results and see your screenshots of your component.

Now, you can change text in the #simple element and run test again and using the link from new results you will see new validation which will show visual difference.

- Examples above and few more you can find in [wct-eyes-example repository](https://github.com/applitools/wct-eyes-example).
