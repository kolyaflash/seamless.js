(function(window, document, $, undefined) {
  // Base seamless functionality between parent and child.
  $.SeamlessBase = {

    /**
     * Returns the value of a query parameter.
     *
     * @param string name
     *   The name of the query parameter to retrieve.
     *
     * @param string from
     *   The string to get the query parameter from.
     *
     * @returns {string}
     *   The value of the query parameter.
     */
    getParam: function(name, from) {
      from = from || window.location.search;
      var regexS = '[?&]' + name + '=([^&#]*)';
      var regex = new RegExp(regexS);
      var results = regex.exec(from);
      if (results === null) {
        return '';
      }
      else {
        return decodeURIComponent(results[1].replace(/\+/g, ' '));
      }
    },

    /**
     * Filters text to remove markup tags.
     *
     * @param text
     * @returns {XML|string|*|void}
     */
    filterText: function(text) {
      return text.replace(/[<>]/g, '');
    },

    /**
     * Determine if an object is empty.
     *
     * @param object obj
     *   The object to check to see if it is empty.
     */
    isEmptyObject: function(obj) {
      var name;
      for (name in obj) {
        return false;
      }
      return true;
    },

    /**
     * Set the styles on an element.
     *
     * @param {object} element
     *   The DOM Element you would like to set the styles.
     * @param {array} styles
     *   The styles to add to the element.
     */
    setStyle: function(element, styles) {

      // Make sure they have styles to inject.
      if (styles.length > 0) {

        // Convert to the right format.
        styles = (typeof styles == 'string') ? styles : styles.join(' ');

        // Keep them from escaping the styles tag.
        styles = $.SeamlessBase.filterText(styles);

        // Add the style to the element.
        if (element.styleSheet) {
          element.styleSheet.cssText = styles;
        }
        else {
          $(element).html(styles);
        }
      }
    },

    /**
     * Provide a cross broser method to inject styles.
     *
     * @param {array} styles
     *   An array of styles to inject.
     */
    injectStyles: function(styles) {

      // See if there are new styles to inject.
      var injectedStyles = $('style#injected-styles');
      if (injectedStyles.length > 0) {
        $.SeamlessBase.setStyle(injectedStyles[0], styles);
      }
      else {

        // Inject the styles.
        var css = $(document.createElement('style')).attr({
          type: 'text/css',
          id: 'injected-styles'
        });
        $.SeamlessBase.setStyle(css[0], styles);
        $('head').append(css);
      }
    }
  };
})(window, document, jQuery);
(function(window, document, $, undefined) {
  /**
   * Create a seamless connection between parent and child frames.
   *
   * @param target
   * @param url
   * @constructor
   */
  $.SeamlessConnection = function(target, url) {
    this.id = 0;
    this.target = target;
    this.url = url;
    this.active = false;
    this.queue = [];
  };

  /**
   * Send a message to the connected frame.
   *
   * @param pm
   */
  $.SeamlessConnection.prototype.send = function(pm) {

    // Only send if the target is set.
    if (this.active && this.target) {

      // Normalize the data.
      if (!pm.hasOwnProperty('data')) {
        pm = {data: pm};
      }

      // Set the other parameters.
      pm.target = this.target;
      pm.url = this.url;
      pm.type = pm.type || 'seamless_data';
      pm.data = pm.data || {};
      pm.data.__id = this.id;
      $.pm(pm);
    }
    else {

      // Add this to the queue.
      this.queue.push(pm);
    }
  };

  /**
   * Receive a message from a connected frame.
   */
  $.SeamlessConnection.prototype.receive = function(type, callback) {
    if (typeof type === 'function') {
      callback = type;
      type = 'seamless_data';
    }

    // Store the this pointer.
    var _self = this;

    // Listen for events.
    $.pm.bind(type, function(data, event) {

      // Only handle data if the connection id's match.
      if (data.__id && (data.__id === _self.id)) {
        return callback(data, event);
      }
      else {

        // Do not handle this event.
        return false;
      }
    });
  };

  /**
   * Sets this connection as active.
   *
   * @param active
   */
  $.SeamlessConnection.prototype.setActive = function(active) {
    this.active = active;

    // Empty the send queue if we have one.
    if (this.queue.length > 0) {
      for(var i in this.queue) {
        this.send(this.queue[i]);
      }
      this.queue = [];
      this.queue.length = 0;
    }
  };
})(window, document, jQuery);
(function(window, document, $, undefined) {

  // Make sure we have the $.pm module loaded.
  if (!$.hasOwnProperty('pm')) {
    console.log('You must install the jQuery.pm module to use seamless.js.');
    return;
  }

  // If any iframe page sends this message, then reload the page.
  $.pm.bind('seamless_noiframe', function(data) {
    // Remove the 'noifame' query parameters.
    data.href = data.href.replace(/noiframe\=[^&?#]+/, '');
    window.location.replace(data.href);
  });

  // Create a way to open the iframe in a separate window.
  window.seamlessOpenFallback = function(src, width, height, event) {
    if (event.preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }
    else {
      event.returnValue = false;
    }
    window.open(src, '', [
      'width=' + width,
      'height=' + height,
      'menubar=no',
      'titlebar=no',
      'toolbar=no',
      'status=no',
      'scrollbars=yes',
      'chrome=yes'
    ].join(','));
  };

  // Keep track of the next connection ID.
  var seamlessFrames = [];
  var connecting = false;
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

  /**
   * Creates a connection ID.
   */
  var getConnectionId = function() {
    var r = [];
    for (var i=0; i < 32; i++) {
      r[i] = chars[0 | Math.random() * 32];
    }
    return r.join("");
  };

  // Call when each child is ready.
  $.pm.bind('seamless_ready', function(data, event) {

    // Only do this if we are not already connecting.
    if (!connecting) {

      // Say we are connecting.
      connecting = true;

      // Iterate through all of our iframes.
      for (var i in seamlessFrames) {

        // Make sure the seamless_ready is a function.
        if (seamlessFrames.hasOwnProperty(i)) {

          // Say that this iframe is ready.
          seamlessFrames[i].seamless_ready(data, event);
        }
      }

      // Say we are no longer connecting.
      connecting = false;
    }
  });

  // Handle the child update message.
  $.pm.bind('seamless_update', function(data, event) {

    // Iterate through all of our iframes.
    for (var i in seamlessFrames) {

      if (seamlessFrames.hasOwnProperty(i)) {

        // Get the iframe.
        var iframe = seamlessFrames[i];

        // Only process if the connection ID's match.
        if (iframe.connection.id === data.__id) {

          // Call this iframes update
          return iframe.seamless_update(data, event);
        }
      }
    }

    // Return that nothing was done.
    data.height = 0;
    return data;
  });

  // If an error occurs.
  $.pm.bind('seamless_error', function(data, event) {

    // Iterate through all of our iframes.
    for (var i in seamlessFrames) {

      if (seamlessFrames.hasOwnProperty(i)) {

        // Fallback this iframe.
        seamlessFrames[i].seamless_error(data, event);
      }
    }
  });

  /**
   * Create the seamless.js plugin.
   */
  $.fn.seamless = function(options) {

    // The default arguments.
    var defaults = {
      loading: 'Loading ...',
      spinner: 'http://www.travistidwell.com/seamless.js/src/loader.gif',
      onConnect: null,
      styles: [],
      fallback: true,
      fallbackParams: '',
      fallbackText: '',
      fallbackLinkText: 'Click here',
      fallbackLinkAfter: ' to open in a separate window.',
      fallbackStyles: [
        'padding: 15px',
        'border: 1px solid transparent',
        'border-radius: 4px',
        'color: #3a87ad',
        'background-color: #d9edf7',
        'border-color: #bce8f1'
      ],
      fallbackLinkStyles: [
        'display: inline-block',
        'color: #333',
        'border: 1px solid #ccc',
        'background-color: #fff',
        'padding: 5px 10px',
        'text-decoration: none',
        'font-size: 12px',
        'line-height: 1.5',
        'border-radius: 6px',
        'font-weight: 400',
        'cursor: pointer',
        '-webkit-user-select: none',
        '-moz-user-select: none',
        '-ms-user-select: none',
        'user-select: none'
      ],
      fallbackLinkHoverStyles: [
        'background-color:#ebebeb',
        'border-color:#adadad'
      ],
      fallbackWindowWidth: 960,
      fallbackWindowHeight: 800
    };

    // Set the defaults if they are not provided.
    options = options || {};
    for (var name in defaults) {
      if (!options.hasOwnProperty(name)) {
        options[name] = defaults[name];
      }
    }

    // Only work with the first iframe object.
    var iframe = $(this).eq(0);

    // Set the seamless_options in the iframe.
    iframe.seamless_options = options;

    // Add this to the global seamless frames object.
    seamlessFrames.push(iframe);

    // Get the name of the iframe.
    var id = iframe.attr('name') || iframe.attr('id');

    // Get the iframe source.
    var src = iframe.attr('src');

    // The connection object.
    iframe.connection = new $.SeamlessConnection(iframe[0].contentWindow, src);

    // Assign the send and receive functions to the iframe.
    iframe.send = function(pm) {
      iframe.connection.send.call(iframe.connection, pm);
    };
    iframe.receive = function(type, callback) {
      iframe.connection.receive.call(iframe.connection, type, callback);
    };

    // Add the necessary attributes.
    iframe.attr({
      'scrolling': 'no',
      'seamless': 'seamless',
      'width': '100%',
      'height': '0px',
      'marginheight': '0',
      'marginwidth': '0',
      'frameborder': '0',
      'horizontalscrolling': 'no',
      'verticalscrolling': 'no'
    }).css({
      border: 'none',
      overflowY: 'hidden'
    });

    // Create the loading div.
    var loading = $(document.createElement('div')).css({
      background: 'url(' + options.spinner + ') no-repeat 10px 13px',
      padding: '10px 10px 10px 60px',
      width: '100%'
    });

    // We are loading.
    var isLoading = true;

    // Append the text.
    loading.append(options.loading);

    // Prepend the loading text.
    iframe.before(loading);

    // If they wish to have a fallback.
    if (options.fallback) {

      // Get the iframe src.
      if (options.fallbackParams) {
        src += (src.search(/\?/) === -1) ? '?' : '&';
        src += options.fallbackParams;
      }

      var fallbackStyles = $('#seamless-fallback-styles');
      if (!fallbackStyles.length) {

        // Get styles from a setting.
        var getStyles = function(stylesArray) {

          // Join the array, and strip out markup.
          return $.SeamlessBase.filterText(stylesArray.join(';'));
        };

        // Create the fallback styles.
        fallbackStyles = $(document.createElement('style')).attr({
          'id': 'seamless-fallback-styles',
          'type': 'text/css'
        });

        // Set the styles for the fallback.
        $.SeamlessBase.setStyle(fallbackStyles[0],
          '.seamless-fallback.seamless-styles {' + getStyles(options.fallbackStyles) + '}' +
          '.seamless-fallback em { padding: 5px; }' +
          '.seamless-fallback-link.seamless-styles {' + getStyles(options.fallbackLinkStyles) + '}' +
          '.seamless-fallback-link.seamless-styles:hover {' + getStyles(options.fallbackLinkHoverStyles) + '}'
        );

        // Add the styles before the iframe.
        iframe.before(fallbackStyles);
      }

      // The arguments to pass to the onclick event.
      var onClickArgs = [
        '"' + src + '"',
        options.fallbackWindowWidth,
        options.fallbackWindowHeight
      ];

      // Create the fallback link.
      var fallbackLink = $(document.createElement('a')).attr({
        'class': 'seamless-fallback-link',
        'href': '#',
        'onclick': 'seamlessOpenFallback(' + onClickArgs.join(',') + ', event)'
      });

      // Create the fallback markup.
      var fallback = $(document.createElement('div')).attr({
        'class': 'seamless-fallback'
      });

      // Add the emphasis element for the text.
      fallback.append($(document.createElement('em')));

      // Set the iframe.
      iframe.after(fallback);

      /**
       * Set the fallback message for the iframe.
       * @param msg
       */
      var setFallback = function(msg, linkText, afterText, showStyles) {

        // If they wish to show the styles.
        if (showStyles) {
          fallback.addClass('seamless-styles');
          fallbackLink.addClass('seamless-styles');
        }
        else {
          fallback.removeClass('seamless-styles');
          fallbackLink.removeClass('seamless-styles');
        }

        // Set the text for the fallback.
        fallback.find('em')
          .text($.SeamlessBase.filterText(msg) + ' ')
          .append(fallbackLink.text($.SeamlessBase.filterText(linkText)))
          .append($.SeamlessBase.filterText(afterText));
      };

      // Set the default fallback.
      if (options.fallbackText) {

        // Create the fallback.
        setFallback(
          options.fallbackText,
          options.fallbackLinkText,
          options.fallbackLinkAfter,
          false
        );
      }

      // Handle all errors with a fallback message.
      $(window).error(function() {
        var msg = 'An error has been detected on this page, ';
        msg += 'which may cause problems with the operation of this application.';

        // Create the fallback.
        setFallback(
          msg,
          options.fallbackLinkText,
          options.fallbackLinkAfter,
          true
        );
      });

      // If nothing happens after 30 seconds, then assume something went wrong.
      setTimeout(function() {
        if (isLoading) {
          loading.remove();
          isLoading = false;

          // Create the fallback.
          setFallback(
            'An error has been detected on this page.',
            options.fallbackLinkText,
            options.fallbackLinkAfter,
            true
          );
        }
      }, 30000);
    }

    /**
     * Called when the child page is ready.
     */
    iframe.seamless_ready = function(data, event) {

      // If no connection ID is established, then set it.
      if (!iframe.connection.id) {
        iframe.connection.id = getConnectionId();
      }

      // Setup the connection data.
      var connectData = {
        id : iframe.connection.id,
        styles: iframe.seamless_options.styles
      };

      // Set the connection target.
      if (!iframe.connection.target) {
        iframe.connection.target = iframe[0].contentWindow;
      }

      // Send the connection message to the child page.
      $.pm({
        type: 'seamless_connect',
        target: iframe.connection.target,
        url: iframe.connection.url,
        data: connectData,
        success: function(data) {
          if (iframe.seamless_options.onConnect) {
            iframe.seamless_options.onConnect(data);
          }
        }
      });

      // Trigger an event.
      iframe.trigger('connected');
    };

    /**
     * Called when this iframe is updated with the child.
     *
     * @param data
     * @param event
     */
    iframe.seamless_update = function(data, event) {

      // See if we are loading.
      if (isLoading) {

        // Remove the loading indicator.
        loading.remove();
        isLoading = false;
        iframe.connection.setActive(true);
      }

      // If the height is 0 or greater, then update.
      if (data.height >= 0) {

        // Set the iframe height.
        iframe.height(data.height).attr('height', data.height + 'px');
      }

      // Return the data.
      return data;
    };

    /**
     * Open this iframe in a fallback window.
     */
    iframe.seamless_error = function(data, event) {

      // Remove the loader and hide the iframe.
      loading.remove();
      iframe.hide();
      isLoading = false;

      // Set the fallback text.
      setFallback(data.msg, data.linkText, data.afterText, true);
    };

    // Return the iframe.
    return iframe;
  };
})(window, document, jQuery);
