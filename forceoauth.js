/**
 * ForceOAuth - Simple OAuth library for Force.com
 * Author: Christophe Coenraets @ccoenraets
 * Version: 0.1
 */
angular.module('force-oauth', [])

    .factory('oauth', function ($rootScope, $q, $window, $http) {

        // The login URL for the OAuth process
        // To override default, pass loginURL in init(props)
        var loginURL = 'https://login.salesforce.com',

        // The Connected App client Id. Default app id provided - Not for production use.
        // This application supports http://localhost:8200/oauthcallback.html as a valid callback URL
        // To override default, pass appId in init(props)
            appId = '3MVG9fMtCkV6eLheIEZplMqWfnGlf3Y.BcWdOf1qytXo9zxgbsrUbS.ExHTgUPJeb3jZeT8NYhc.hMyznKU92',

        // Keep track of OAuth data (access_token, refresh_token, and instance_url)
            oauth,

        // By default we store fbtoken in sessionStorage. This can be overridden in init()
            tokenStore = {},

        // if page URL is http://localhost:3000/myapp/index.html, context is /myapp
            context = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")),

        // if page URL is http://localhost:3000/myapp/index.html, serverURL is http://localhost:3000
            serverURL = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : ''),

        // if page URL is http://localhost:3000/myapp/index.html, baseURL is http://localhost:3000/myapp
            baseURL = serverURL + context,

        // Only required when using REST APIs in an app hosted on your own server to avoid cross domain policy issues
        // To override default, pass proxyURL in init(props)
            proxyURL = baseURL,

        // if page URL is http://localhost:3000/myapp/index.html, oauthCallbackURL is http://localhost:3000/myapp/oauthcallback.html
        // To override default, pass oauthCallbackURL in init(props)
            oauthCallbackURL = baseURL + '/oauthcallback.html',

        // Because the OAuth login spans multiple processes, we need to keep the login success and error handlers as a variables
        // inside the module instead of keeping them local within the login function.
            deferredLogin,

        // Reference to the Salesforce OAuth plugin
            oauthPlugin,

        // Whether or not to use a CORS proxy. Defaults to false if app running in Cordova or in a VF page
        // Can be overriden in init()
            useProxy = (window.cordova || window.SfdcApp) ? false : true;

        function parseQueryString(queryString) {
            var qs = decodeURIComponent(queryString),
                obj = {},
                params = qs.split('&');
            params.forEach(function (param) {
                var splitter = param.split('=');
                obj[splitter[0]] = splitter[1];
            });
            return obj;
        }

        function toQueryString(obj) {
            var parts = [],
                i;
            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
                }
            }
            return parts.join("&");
        }

        function refreshTokenWithPlugin(deferred) {
            oauthPlugin.authenticate(
                function(response) {
                    oauth.access_token = response.accessToken;
                    tokenStore.forceOAuth = JSON.stringify(oauth);
                    deferred.resolve();
                },
                function() {
                    console.log('Error refreshing oauth access token using the oauth plugin');
                    deferred.reject();
                });
        }

        function refreshTokenWithHTTPRequest(deferred) {
            var params = {
                    'grant_type': 'refresh_token',
                    'refresh_token': oauth.refresh_token,
                    'client_id': appId
                },

                headers = {},

                url = useProxy ? proxyURL : loginURL;

            // dev friendly API: Remove trailing '/' if any so url + path concat always works
            if (url.slice(-1) === '/') {
                url = url.slice(0, -1);
            }

            url = url + '/services/oauth2/token?' + toQueryString(params);

            if (!useProxy) {
                headers["Target-URL"] = loginURL;
            }

            $http({
                headers: headers,
                method: 'POST',
                url: url,
                params: params})
                .success(function(data, status, headers, config) {
                    console.log('Token refreshed');
                    oauth.access_token = data.access_token;
                    tokenStore.forceOAuth = JSON.stringify(oauth);
                    deferred.resolve();
                })
                .error(function(data, status, headers, config) {
                    console.log('Error while trying to refresh token');
                    deferred.reject();
                });
        }

        function refreshToken() {
            var deferred = $q.defer();
            if (oauthPlugin) {
                refreshTokenWithPlugin(deferred);
            } else {
                refreshTokenWithHTTPRequest(deferred);
            }
            return deferred.promise;
        }

        /**
         * Initialize ForceNG
         * @param params
         *  appId (optional)
         *  loginURL (optional)
         *  proxyURL (optional)
         *  oauthCallbackURL (optional)
         *  apiVersion (optional)
         *  accessToken (optional)
         *  instanceURL (optional)
         *  refreshToken (optional)
         */
        function init(params) {

            if (params) {
                appId = params.appId || appId;
                apiVersion = params.apiVersion || apiVersion;
                loginURL = params.loginURL || loginURL;
                oauthCallbackURL = params.oauthCallbackURL || oauthCallbackURL;
                proxyURL = params.proxyURL || proxyURL;
                useProxy = params.useProxy === undefined ? useProxy : params.useProxy;

                if (params.accessToken) {
                    if (!oauth) oauth = {};
                    oauth.access_token = params.accessToken;
                }

                if (params.instanceURL) {
                    if (!oauth) oauth = {};
                    oauth.instance_url = params.instanceURL;
                }

                if (params.refreshToken) {
                    if (!oauth) oauth = {};
                    oauth.refresh_token = params.refreshToken;
                }
            }

            console.log("useProxy: " + useProxy);
        }

        /**
         * Discard the OAuth access_token. Use this function to test the refresh token workflow.
         */
        function discardToken() {
            delete oauth.access_token;
            tokenStore.forceOAuth = JSON.stringify(oauth);
        }

        /**
         * Called internally either by oauthcallback.html (when the app is running the browser)
         * @param url - The oauthCallbackURL called by Salesforce at the end of the OAuth workflow. Includes the access_token in the querystring
         */
        function oauthCallback(url) {

            // Parse the OAuth data received from Facebook
            var queryString,
                obj;

            if (url.indexOf("access_token=") > 0) {
                queryString = url.substr(url.indexOf('#') + 1);
                obj = parseQueryString(queryString);
                oauth = obj;
                tokenStore['forceOAuth'] = JSON.stringify(oauth);
                if (deferredLogin) deferredLogin.resolve(oauth);
            } else if (url.indexOf("error=") > 0) {
                queryString = decodeURIComponent(url.substring(url.indexOf('?') + 1));
                obj = parseQueryString(queryString);
                if (deferredLogin) deferredLogin.reject(obj);
            } else {
                if (deferredLogin) deferredLogin.reject({status: 'access_denied'});
            }
        }

        /**
         * Login to Salesforce using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
         */
        function login() {
            deferredLogin = $q.defer();
            if (window.cordova) {
                loginWithPlugin();
            } else {
                loginWithBrowser();
            }
            return deferredLogin.promise;
        }

        function loginWithPlugin() {
            document.addEventListener("deviceready", function () {
                oauthPlugin = cordova.require("com.salesforce.plugin.oauth");
                if (!oauthPlugin) {
                    console.error('Salesforce Mobile SDK OAuth plugin not available');
                    if (deferredLogin) deferredLogin.reject({status: 'Salesforce Mobile SDK OAuth plugin not available'});
                    return;
                }
                oauthPlugin.getAuthCredentials(
                    function (creds) {
                        // Initialize ForceJS
                        init({accessToken: creds.accessToken, instanceURL: creds.instanceUrl, refreshToken: creds.refreshToken});
                        if (deferredLogin) deferredLogin.resolve();
                    },
                    function (error) {
                        console.log(error);
                        if (deferredLogin) deferredLogin.reject(error);
                    }
                );
            }, false);
        }

        function loginWithBrowser() {
            console.log('loginURL: ' + loginURL);
            console.log('oauthCallbackURL: ' + oauthCallbackURL);

            var loginWindowURL = loginURL + '/services/oauth2/authorize?client_id=' + appId + '&redirect_uri=' +
                oauthCallbackURL + '&response_type=token';
            window.open(loginWindowURL, '_blank', 'location=no');
        }

        /**
         * Gets the user's ID (if logged in)
         * @returns {string} | undefined
         */
        function getUserId() {
            return (typeof(oauth) !== 'undefined') ? oauth.id.split('/').pop() : undefined;
        }

        /**
         * Check the login status
         * @returns {boolean}
         */
        function isAuthenticated() {
            return (oauth && oauth.access_token) ? true : false;
        }

        // The public API
        return {
            init: init,
            login: login,
            refreshToken: refreshToken,
            getUserId: getUserId,
            isAuthenticated: isAuthenticated,
            discardToken: discardToken,
            oauthCallback: oauthCallback
        };

    });

// Global function called back by the OAuth login dialog
function oauthCallback(url) {
    var injector = angular.element(document.body).injector();
    injector.invoke(function (oauth) {
        oauth.oauthCallback(url);
    });
}