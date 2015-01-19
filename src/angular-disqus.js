(function (angular, window) {
  'use strict';

  var disqusModule = angular.module('ngDisqus', [ ]);

  /**
   * $disqus provider.
   */
  disqusModule.provider('$disqus', function() {
    var TYPE_EMBED = 'embed.js'; // general disqus embed script
    var TYPE_COUNT = 'count.js'; // used for count

    // Placeholder for the disqus shortname
    var shortname;

    // SSO vars
    var sso;
    var sso_enabled = false;

    /**
     * @return {Element} dom element for script adding
     */
    function getScriptContainer() {
      return (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]);
    }

    /**
     * @return {String} disqus shortname
     */
    function getShortname() {
      return shortname || window.disqus_shortname;
    }

    /**
     * Return true if SSO data is ready
     *
     * @return {Boolean} true if auth and api_key are set, false otherwise
     */
    function isSSOValid(data) {
      return data.auth && data.api_key;
    }

    /**
     * @param {String} shortname disqus shortname
     * @param {String} file file name to add.
     * @return {String} disqus embed src with embedded shortname
     */
    function getScriptSrc(shortname, file) {
      return '//' + shortname + '.disqus.com/' + file;
    }

    /**
     * Builds the script tag
     *
     * @param {String} src script source
     * @return {Element} script element
     */
    function buildScriptTag(src) {
      var script = document.createElement('script');

      // Configure the script tag
      script.type  = 'text/javascript';
      script.async = true;
      script.src   = src;

      return script;
    }

    /**
     * Build the SSO Disqus script
     *
     * @param  {String} src The SSO code
     * @return {Element} script element
     */
    function buildSSOScriptTag(src) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.text = src;

      return script;
    }

    /**
     * Searches the given element for defined script tag
     * if its already there then return true. Otherwise return false
     *
     * @param {Element} element element to search within
     * @param {String} scriptSrc script src
     * @return {Boolean} true if its there, false if its not
     */
    function hasScriptTagInPlace(container, scriptSrc) {
      var scripts   = container.getElementsByTagName('script'),
      script, i;

      for (i = 0; i < scripts.length; i += 1) {
        script = scripts[i];

        // Check if the name contains the given values
        // We need to check with indexOf because browsers replace // with their protocol
        if (~script.src.indexOf(scriptSrc)) {
          return true;
        }
      }

      return false;
    }

    /**
     * Writes disqus globals to window object.
     * Needed for the first load. Otherwise the disqus wouldn't know what thread comments to load.
     *
     * @param {String} id disqus identifier
     * @param {String} url disqus url
     * @param {String} shortname disqus shortname
     */
    function setGlobals(id, url, shortname) {
      window.disqus_identifier = id;
      window.disqus_url        = url;
      window.disqus_shortname  = shortname;
    }

    /**
     * Refreshes the count from DISQUSWIDGETS.
     */
    function getCount() {
      var widgets = window.DISQUSWIDGETS;
      if (widgets && angular.isFunction(widgets.getCount)) {
        widgets.getCount();
      }
    }

    /**
     * Generate the SSO configuration code. An object must be passed with:
     * - auth: the authorization key as '<message> <hmac> <timestamp>'
     * - api_key: the public key of the your Disqus application
     *
     * @param  {Object} ssoData The SSO configuration object.
     * @return {String} The generated code.
     *
     * @see https://help.disqus.com/customer/portal/articles/236206
     */
    function getSSOScriptTagCode(ssoData) {
      return 'var disqus_config = function () {\n'
        + '  this.page.remote_auth_s3 = "' + ssoData.auth + '";\n'
        + '  this.page.api_key = "' + ssoData.api_key + '";\n'
        + '}'
    }

    /**
     * Trigger the reset comment call
     * @param  {String} $location location service
     * @param  {String} id Thread id
     */
    function resetCommit($location, id) {
      window.DISQUS.reset({
        reload: true,
        config : function() {
          this.page.identifier = id;
          this.page.url        = $location.absUrl();
        }
      });
    }

    /**
     * Adds disqus script tag to header by its type.
     * If the script tag already exists in header then wont continue.
     *
     * Adds script tags by their type.
     * Currently we are using two types:
     *  1. count.js
     *  2. embed.js
     *
     * @param {String} shortname disqus shortname
     * @param {String} type disqus script tag type
     */
    function addScriptTag(shortname, type) {
      var container = getScriptContainer(),
      scriptSrc = getScriptSrc(shortname, type);

      // If it already has a script tag in place then lets not do anything
      // This might happen if the user changes the page faster than then disqus can load
      if (hasScriptTagInPlace(container, scriptSrc)) {
        return;
      }

      // Build the script tag and append it to container
      container.appendChild(buildScriptTag(scriptSrc));
    }

    /**
     * Adds disqus SSO script to the header
     *
     * @param {Object} ssoData And object that contains auth and public key.
     */
    function addSSOScriptTag(ssoData) {
      var container = getScriptContainer();
      var scriptCode = getSSOScriptTagCode(ssoData);
      container.appendChild(buildSSOScriptTag(scriptCode));
    }

    /**
     * @param {String} sname shortname
     */
    this.setShortname = function(sname) {
      shortname = sname;
    };

    /**
     * Make disqus waiting for SSO configuration.
     * This must be called from the $disqusProvider configuration to enable SSO.
     */
    this.enableSSO = function() {
      sso_enabled = true;
    };

    // Provider constructor
    this.$get = [ '$rootScope', '$location', '$http', function($rootScope, $location, $http) {

      /**
       * Resets the comment for thread.
       * If disqus was not defined then it will add disqus to script tags.
       * If disqus was initialized earlier then it will just use disqus api to reset it
       *
       * @param  {String} id required thread id
       */
      function commit(id) {
        var shortname = getShortname();

        if (!angular.isDefined(shortname)) {
          throw new Error('No disqus shortname defined');
        } else if (!angular.isDefined(id)) {
          throw new Error('No disqus thread id defined');
        } else if (angular.isDefined(window.DISQUS)) {
          resetCommit($location, id);
        } else {
          setGlobals(id, $location.absUrl(), shortname);

          // if SSO let get the sso data
          if (sso_enabled) {
            $rootScope.$on('disqus:sso:ready', function() {
              addScriptTag(shortname, TYPE_EMBED);
            });
          } else {
            addScriptTag(shortname, TYPE_EMBED);
          }
        }
      }

      /**
       * Set the SSO configuration and define disqus_config function.
       *
       * @param {String} uri URI from which to load the SSO configuration.
       */
      function configSSO(uri) {
        $http.get(uri).success(function (data) {
          addSSOScriptTag(data);
          $rootScope.$emit('disqus:sso:ready');
        });
      }

      /**
       * Loads the comment script tag and initiates the comments.
       * Sets the globals according to the current page.
       *
       * If the embed disqus is not added to page then adds that.
       *
       * @param {String} id thread id
       */
      function loadCount(id) {
        setGlobals(id, $location.absUrl(), shortname);
        addScriptTag(getShortname(), TYPE_EMBED);
        addScriptTag(getShortname(), TYPE_COUNT);
        getCount();
      }

      // Expose public api
      return {
        commit       : commit,
        getShortname : getShortname,
        loadCount    : loadCount,
        configSSO    : configSSO
      };
    }];
  });

  /**
   * Disqus thread comment directive.
   * Used to display the comments block for a thread.
   */
  disqusModule.directive('disqus', [ '$disqus', function($disqus) {

    return {
      restrict : 'AC',
      replace  : true,
      scope    : {
        id : '=disqus',
      },
      template : '<div id="disqus_thread"></div>',
      link: function link(scope) {
        scope.$watch('id', function(id) {
          if (angular.isDefined(id)) {
            $disqus.commit(id);
          }
        });
      }
    };
  }]);

  /**
   * Disqus comment count directive.
   * Just wraps `disqus-identifier` to load the disqus comments count script tag on page
   */
  disqusModule.directive('disqusIdentifier', [ '$disqus', function($disqus) {
    return {
      restrict : 'A',
      link     : function(scope, elem, attr) {
        $disqus.loadCount(attr.disqusIdentifier);
      }
    };
  }]);

  /**
   * Disqus SSO directive.
   * Just wraps `disqus-sso-uri` to configure the disqus_config script.
   */
  disqusModule.directive('disqusSsoUri', [ '$disqus', function($disqus) {
    return {
      restrict: 'A',
      link: function (scope, elem, attr) {
        $disqus.configSSO(attr.disqusSsoUri);
      }
    };
  }]);

})(angular, this);
