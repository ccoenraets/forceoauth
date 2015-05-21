# ForceOAuth
### AngularJS Service for Salesforce OAuth Authentication


## Quick Start

To run the sample provided in this repository:

1. Install force-server

    Because of the browser's cross-origin restrictions, your JavaScript application hosted on your own server (or localhost) will not be able to make API calls directly to the *.salesforce.com domain. The solution is to proxy your API calls through your own server. You can use your own proxy server, but ForceNG is tightly integrated with [ForceServer](https://github.com/ccoenraets/force-server), a simple development server for Force.com. To install ForceServer, make sure Node.js is installed on your system, open a command prompt and execute the following command:

    ```
    npm install -g force-server
    ```

    or (Unix-based systems)

    ```
    sudo npm install -g force-server
    ```

1. Clone this repository or download and unzip [this]() zip file

1. ```cd``` to the ```forceoauth``` directory

1. Run the application:

    ```
    force-server
    ```

    This starts the ForceServer server on port 8200 and loads your sample app in your default browser. After authenticating against your developer org, you should see a list of OAuth values. 
