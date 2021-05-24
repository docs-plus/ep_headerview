'use strict';
const _ = require('underscore');

const $body_ace_outer = () => $(document).find('iframe[name="ace_outer"]').contents();

// Bind the event handler to the toolbar buttons
exports.postAceInit = (hookName, context) => {
  const $filterInput = $('#heading-view');
  let headerContetnts = [];
  let filterResult = [];

  // append custom style element to the pad inner.
  $body_ace_outer().find('iframe')
      .contents().find('head').append('<style id="customHeader"></style>');

  const clearCssFilter = () => $body_ace_outer()
      .find('iframe').contents().find('head #customHeader').html('');

  const evaluateSearchResult = (value, callback) => {
    const val = value;
    const regEx = new RegExp(val, 'gi');
    const results = headerContetnts.filter((x) => x.text.match(regEx));
    console.log(value, callback, results);

    let messge = 'Opps! No results found.';
    if (results.length) {
      const result = results.length === 1 ? 'result' : 'results';
      messge = `About <b>${results.length}</b> ${result} found.`;
    } else {
      $("#heading-result-msg").addClass("active")
    }

    if (val.length <= 1) messge = 'Search through the headers';

    $('#heading-result-msg').html(`<p>${messge}</p>`);
    filterResult = results;
    if (callback) callback(results);
  };

  const appendCssFilter = () => {
    let css = '';
    let cssIsFilter = [];
    filterResult.forEach((val, index) => {
      cssIsFilter.push(`[wrapper="${val.wrapper}"]`);
    });
    cssIsFilter = cssIsFilter.join(',');
    css = `
        div.ace-line{
          position: relative;
        }

        div.ace-line:not(:is(${cssIsFilter})) *{
          visibility: hidden;
          height:0;
          display:none!important;
        }

        div.ace-line:is(${cssIsFilter}):after,
        div.ace-line:is(${cssIsFilter}):before{
          position: relative;
          font-size: 1.5em;
          height: 1em;
          border: 0;
          width: 150%;
        }

        div.ace-line:not(:is(${cssIsFilter})):after,
        div.ace-line:not(:is(${cssIsFilter})):before,
        div.ace-line:not(:is(${cssIsFilter})):after,
        div.ace-line:not(:is(${cssIsFilter})):before{
          content: "";
          display: block;
          position: absolute;
          left: 0;
          right: 0;
          background-size: 2em 100%;
          height: 16px;
        }

        div.ace-line:not(:is(${cssIsFilter})):after,
        div.ace-line:not(:is(${cssIsFilter})):after{
          -webkit-filter: drop-shadow(hsla(0, 0%, 80%, 0.3) 1px 3px 5px);

        }

        div.ace-line:not(:is(${cssIsFilter})):after,
        div.ace-line:not(:is(${cssIsFilter})):before{
          transform: translateY(-20px);
        }

        div.ace-line:not(:is(${cssIsFilter})):after,
        div.ace-line:not(:is(${cssIsFilter})):after{
          background-image:
          linear-gradient(135deg, hsla(210deg, 17%, 90%, 0.2) 30%, transparent 30%),
          linear-gradient(225deg, hsla(210deg, 17%, 90%, 0.2) 30%, transparent 30%);
          background-position: -webkit-calc(50% - 1em);
          top: 0.5em;
        }

        div.ace-line:not(:is(${cssIsFilter})):before,
        div.ace-line:not(:is(${cssIsFilter})):before{
          background-image:
          linear-gradient(315deg, hsla(210deg, 17%, 90%, 0.2) 30%, transparent 30%),
          linear-gradient(45deg, hsla(210deg, 17%, 90%, 0.2) 30%, transparent 30%);
          background-position: 50%;
          top: -0.5em;
        }

        div.ace-line:not(:is(${cssIsFilter})){ margin-top:30px; }
        div.ace-line:not(:is(${cssIsFilter})){ margin-bottom:30px; }
      `;

    $body_ace_outer().find('iframe').contents().find('head #customHeader').html(css);
  };

  const updateHeaderList = (callback) => {
    const headers = $body_ace_outer().find('iframe').contents().find('div :header');
    headerContetnts = [];
    headers.each(function () {
      const text = $(this).text();
      const headerId = $(this).attr('data-id');
      const wrapper = $(this).parent().attr('wrapper');
      headerContetnts.push({text, headerId, wrapper});
    });
    if (callback) callback(headerContetnts);
  };


  if (clientVars.padId !== clientVars.padView) {
    $('#headerView').show();
    $('#heading-view').val(clientVars.padName);

    updateHeaderList((headerContetnts) => {
      evaluateSearchResult($filterInput.val(), (result) => {
        appendCssFilter();
      });
    });
  }

  const searchResult = _.debounce(evaluateSearchResult, 300);

  $filterInput
      .focusin(function () {
        const inputText = $(this).val();
        $('#heading-result-msg').addClass('active');
        searchResult(inputText);
        if (inputText) {
          $('.btn-clearInput').addClass('active');
        } else {
          $('.btn-clearInput').removeClass('active');
        }
        updateHeaderList();
      })
      .focusout(function () {
        const inputText = $(this).val();
        $('#heading-result-msg').removeClass('active');
        if (inputText.length) {
          $('.btn-clearInput').addClass('active');
        } else {
          $('.btn-clearInput').removeClass('active');
        }
      })
      .keypress((event) => {
      // enter
        if (event.which === 13 && filterResult.length) {
          appendCssFilter();
          updateHeaderList();
        } else {
        // TODO: performance issue
          clearCssFilter();
          updateHeaderList();
        }
      })
      .keyup(function () {
        const inputText = $(this).val();
        if (inputText.length) {
          $('.btn-clearInput').addClass('active');
        } else {
          $('.btn-clearInput').removeClass('active');
        }
        searchResult(this);
      });

  $('.btn-clearInput').on('click', function () {
    $('#heading-view').val('');
    clearCssFilter();
    $(this).removeClass('active');
    $('#heading-result-msg').html('<p>Search through the headers</p>');
    updateHeaderList();
  });

};
