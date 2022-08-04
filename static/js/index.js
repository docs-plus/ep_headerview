import debounce from 'lodash-es/debounce';
import slugify from 'slugify';
import * as Helper from './helper';
import {Store} from './store';

let socket;

export const aceEditorCSS = () => {
  const version = clientVars.headerView.version || 1;
  return [`ep_headerview/static/css/innerLayer.css?v=${version}`];
};

const clearFilterListSection = () => {
  $('.section_filterList ul li').remove();
  $('.section_filterList ul')
      .append(`
        <li class="filterEmpty">
          <p>There is no filter <br> create the first filter</p>
        </li>
      `);
};

const createNewFilter = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const filterName = $('#filter_name').val();
  const filterUrl = $('#filter_url').val();

  $('.section_filterList .loader').show();

  if (!filterName || !filterUrl) return false;

  if (Helper.doesSlugExist(filterUrl)) {
    console.info('[headerview]: The filter already exists');
    return false;
  }

  const filter = {
    name: filterName,
    id: Helper.randomString(),
    slug: filterUrl,

  };

  console.info('[headerview]: create filter: ', filter);

  // submit filter
  socket.emit('addNewFilter', clientVars.padId, filter, (res) => {
    Helper.appendFilter(res);
    $('.section_filterList .loader').hide();
  });

  // clear form
  $('#filter_name, #filter_url').val('');
  $('.btn_createFilter').removeClass('active').attr('disabled', true);
  $('.filterNumResults').text(0);
};

// =======>>>

const displayFilterModal = () => {
  Helper.closeOpenFilterModal(() => {
    Helper.adoptFilterModalPosition();
  });
};

const initSocket = () => {
  const loc = document.location;
  const port = loc.port === '' ? loc.protocol === 'https:' ? 443 : 80 : loc.port;
  let socketURL = `${loc.protocol}//${loc.hostname}:${port}`;

  socketURL = `${socketURL}/headerview`;

  socket = io.connect(socketURL, {
    query: `padId=${clientVars.padId}`,
  });

  socket.on('disconnect', (reason) => {
    console.error('[headerView]: socket disconnection, reason:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[headerView]: socket connect_error:', error);
  });

  socket.on('addNewFilter', Helper.appendFilter);

  socket.on('removeFilter', Helper.removeFilter);
};

const appendCustomStyleTag = () => {
  // padOuter
  $(document)
      .find('head')
      .append('<style id="tocCustomHeader"></style>');

  // padInner
  Helper.$bodyAceOuter()
      .find('iframe')
      .contents()
      .find('head')
      .append('<style id="customHeader"></style>');
};

const eventListner = () => {
  if (!$('body').hasClass('mobileView')) {
    $(window).resize(debounce(Helper.adoptFilterModalPosition, 250));
  }

  $(document).on('click', '.btn_createFilter', createNewFilter);
  $(document).on('submit', '#epFilterForm', createNewFilter);

  $(document).on('click', 'button#btn_filterView, button#btnOpenFilterModal', (e) => {
    displayFilterModal();
    $('.section_filterList .loader').show();
    $('.section_filterList ul').css({opacity: 0});

    socket.emit('getFilterList', clientVars.padId, Helper.getPadSlugs(), (list) => {
      clearFilterListSection();
      clientVars.ep_headerview.filterList = list;
      list.forEach((row) => {
        if (!Store.filterList.has(row.id)) Store.filterList.set(row.id, row);
        if (!row) return;
        Helper.appendFilter(row);
      });
      $('.section_filterList ul').css({opacity: 1});
      $('.section_filterList .loader').hide();
    });
  });

  $(document)
      .on('click',
          'button#btn_filterView, button#btnOpenFilterModal, #filterModal button.btn_closeModal', () => {
            Helper.updateHeaderList(null, Store.includeSections);
          });

  $(document)
      .on('click', '#filterModal button.btn_closeModal', () => Helper.closeOpenFilterModal());

  $(document).on('click', '.btn_filter_remove', function () {
    const filterId = $(this).attr('filter-id');
    const active = $(this).attr('active');
    const highlight = $(this).attr('highlight');
    const filter = Store.filterList.get(filterId);

    const undoRow = $('#filter_remove_undo').tmpl({
      filter,
      active,
      highlight,
    });

    $(`.section_filterList ul li.row_${filterId}`).html(undoRow);

    Store.undoTimeList[filterId] = setTimeout(() => {
      delete Store.undoTimeList[filterId];
      socket.emit('removeFilter', clientVars.padId, filter, (res) => {
        console.info(`
          [headerview]: filter has been removed; id ${filterId}, res: ${res}, filter:`, filter
        );
        Helper.removeFilter(filter);
      });
    }, 2000);
  });

  $(document).on('click', '.btn_undoDelete', function () {
    const filterId = $(this).attr('filter-id');
    const active = $(this).attr('active');
    const highlight = $(this).attr('highlight');

    clearTimeout(Store.undoTimeList[filterId]);
    delete Store.undoTimeList[filterId];

    const rowFilter = $('#filter_listItem').tmpl({
      filter: Store.filterList.get(filterId),
      active,
      highlight,
    });

    $(`.section_filterList ul li.row_${filterId}`)
        .html(`
          <li class="row_${filterId}" active="${active}" highlight="${highlight}">
            ${$(rowFilter).html()}
          </li>
        `);
  });

  $(document)
      .on('keyup input', '.section_form input#filter_name', function () {
        const inputText = $(this).val();
        Helper.searchResult(inputText);
        if (inputText.length > 0) {
          $('#filter_url')
              .val(slugify(inputText, {lower: true, strict: true}));
        }
      })
      .on('focusout input', '.section_form input#filter_name', function () {
        const inputText = $(this).val();
        if (inputText.length > 0) {
          $('#filter_url')
              .val(slugify(inputText, {lower: true, strict: true}));
        }
        $('.filterNumResults').removeClass('active');
      })
      .on('focusin input', '.section_form input#filter_name', function (param) {
        const inputText = $(this).val();
        $('.filterNumResults').addClass('active');
        Helper.searchResult(inputText);
      });

  $('#filter_url').focusout(function () {
    const val = $(this).val();
    if (val.length > 0) $(this).val(slugify(val, {lower: true, strict: true}));
  })
      .focusin(() => {
        $('.filterNumResults').addClass('active');
      })
      .focusout(() => {
        $('.filterNumResults').removeClass('active');
      })
      .keyup(function () {
        const val = $(this).val();
        if (!Helper.doesSlugExist(val)) {
          $('.btn_createFilter').addClass('active').removeAttr('disabled');
        } else {
          $('.btn_createFilter').removeClass('active').attr('disabled', true);
        }
      });
};

export const postAceInit = (hookName, context) => {
  clientVars.ep_headerview = {};
  initSocket();
  appendCustomStyleTag();
  eventListner();
  Helper.innerSkeleton('append');


  const epTableOfContentsPlugin = (includeSections) => {
    const plugins = clientVars.plugins.plugins || {};
    if (!plugins.hasOwnProperty('ep_table_of_contents')) return false;
    const css = `
      #tocItems .tocItem{
        display: none;
      }
      #tocItems .tocItem:is(${includeSections}) {
        display: flex;
      }
    `;
    $(document).find('head #tocCustomHeader').html(css);
  };

  const createCssFilterForParentHeaders = (tagIndex, titleId, section, lrhSectionId) => `[sectionid='${lrhSectionId}'],[titleid='${titleId}'][lrh${tagIndex}='${section.lrhMark[tagIndex]}']`;

  const createCssFilterForChildeHeaders = (tagIndex, titleId, section, lrhSectionId) => {
    let results = '';
    if (section.lastFilter) {
      results = `[sectionid='${lrhSectionId}'],[titleid='${titleId}'][lrh${tagIndex}='${section.lrhMark[tagIndex]}']`;
    } else {
      results = `[sectionid='${lrhSectionId}']`;
    }
    return results;
  };

  const appendCssFilter = (callback, locationPath) => {
    let css = '';
    let bucketSearchResult = [];
    const filterIncludesSections = [];
    const slugsScore = {};
    const sectionsContaintSlugs = [];

    // If there were no filters in that list
    // if (Store.filterList.size === 0) return true;

    let currentPath = location.pathname.split('/');
    if (locationPath) currentPath = locationPath.split('/');
    let filterURL = [...currentPath].splice((Helper.doesHaveP() ? 3 : 2), currentPath.length - 1);

    // console.info('[headerview]: filterURL', filterURL.length, currentPath, clientVars.ep_singlePad.active)

    if (clientVars.ep_singlePad.active) {
      filterURL = location.pathname.split('/');
      if (locationPath) filterURL = locationPath.split('/');
      const doesUrlHavePadId = filterURL.indexOf(clientVars.padId) >= 0;

      // /p/padName/slug = ["", "p","padName","slug"] OR /padName/slug = ["", "padName", slug]
      if (Helper.doesHaveP() || doesUrlHavePadId) {
        filterURL = [...currentPath].splice((Helper.doesHaveP() ? 3 : 2), currentPath.length - 1);
      } else { filterURL.shift(); } // /slug = ["", "slug"]

      // in development mode
      if (doesUrlHavePadId) filterURL = filterURL.filter((x) => x !== clientVars.padId);
    }

    console.info('[headerview]: filterURL', filterURL, filterURL.indexOf(clientVars.padId));

    if (filterURL.length === 0 || filterURL[0] === '') {
      // clear css filter
      Helper.$bodyAceOuter()
          .find('iframe')
          .contents()
          .find('head #customHeader')
          .html('');

      $(document).find('head #tocCustomHeader').html(css);

      Helper.innerSkeleton('hide');

      return true;
    }

    // Give score to the slugs and reorder the filter for nested search
    filterURL.forEach((slug, index) => {
      const filter = Array.from(Store.filterList.values()).find((x) => x.slug === slug);
      const regEx = new RegExp(filter.name, 'gi');

      if (!slugsScore[slug]) {
        slugsScore[slug] = {text: filter.name, count: 0, sumTagIndex: 0, score: 0};
      }
      // TODO: [performance-issue]: change this loop cycle
      const sectionsSlugs = Store.headerContetnts.filter((x) => {
        const is = x.text.match(regEx);
        if (is) {
          slugsScore[slug].count += 1;
          slugsScore[slug].sumTagIndex += x.tag;
        }
        return is;
      });
      sectionsContaintSlugs.push(...sectionsSlugs);
    });

    // console.info(`[headerview]: headerContetnts,`, headerContetnts)
    // console.info(`[headerview]: sectionsContaintSlugs,`, sectionsContaintSlugs)

    const slugsScoreKeys = Object.keys(slugsScore);

    // Calculate the slug score
    slugsScoreKeys.forEach((slug) => {
      const count = slugsScore[slug].count;
      const sumTagIndex = slugsScore[slug].sumTagIndex;
      slugsScore[slug].score = sumTagIndex / count;
    });

    // console.info('[headerview]: slugsScore', slugsScore);

    // sort slug by score
    const sortedSlugs = slugsScoreKeys.sort((a, b) => slugsScore[a].score - slugsScore[b].score);

    console.info('[headerview]: sortedSlugs', sortedSlugs);

    for (const [index, slug] of sortedSlugs.entries()) {
      const regEx = new RegExp(slugsScore[slug].text, 'gi');

      let results = [];

      if (bucketSearchResult.length === 0) {
        // filter all header with given first filter
        results = Store.headerContetnts.filter((x) => x.text.match(regEx));
        Store.filteredHeaders.push(...results);
      } else {
        const lrh1IdList = bucketSearchResult.map((x) => x.lrh1);
        const titleIdList = bucketSearchResult.map((x) => x.titleId);

        let newBucketSearchResult = Store.headerContetnts.filter((x) => titleIdList.includes(x.titleId));


        if (!lrh1IdList.some((x) => x === undefined)) {
          newBucketSearchResult = Store.headerContetnts.filter((x) => lrh1IdList.includes(x.lrh1));
        }

        results = newBucketSearchResult.filter((x) => x.text.match(regEx));
        Store.filteredHeaders.push(...results);

        if (index === sortedSlugs.length - 1) {
          results = results.map((x) => ({...x, lastFilter: true}));
        }

        filterIncludesSections.push(...results);
        // save every last slug result
        if (index >= 1) bucketSearchResult = [];
      }

      bucketSearchResult.push(...results);
    }

    // console.info('[headerview]: filteredHeaders,', Store.filteredHeaders, 'filterIncludesSections', filterIncludesSections);

    // ======================
    // CREATE CSS FILTER BASED "filterIncludesSections" VARIABLE
    // ======================

    // filter with parent // limite the search result by title header Id
    const otherParentHeader = Store.filteredHeaders.filter((x) => x.tag === 1).map((x) => x.titleId);
    if (filterURL.length > 1) {
      Store.filteredHeaders = Store.filteredHeaders.filter((x) => otherParentHeader.includes(x.titleId));
    }

    // if just one filter name has activated
    if (filterURL.length === 1) {
      for (const section of Store.filteredHeaders) {
        const tagIndex = section.tag;
        const titleId = section.titleId;

        const includeParts = section.lrhMark
            .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
            .map((lrhSectionId) => createCssFilterForParentHeaders(tagIndex, titleId, section, lrhSectionId));

        Store.includeSections.push(...includeParts);
      }

      for (const section of Store.filteredHeaders) {
        const tagIndex = section.tag;
        const titleId = section.titleId;

        const includeParts = section.lrhMark
            .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
            .map((lrhSectionId) => createCssFilterForChildeHeaders(tagIndex, titleId, section, lrhSectionId));

        Store.includeSections.push(...includeParts);
      }
    } else {
      // If we have more than one active filter
      for (const section of filterIncludesSections) {
        const tagIndex = section.tag;
        const titleId = section.titleId;

        const includeParts = section.lrhMark
            .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
            .map((lrhSectionId) => createCssFilterForChildeHeaders(tagIndex, titleId, section, lrhSectionId));

        Store.includeSections.push(...includeParts);
      }
    }

    // console.log('[headerview]: includeSections', Store.includeSections);
    const cssSectionSelecrots = Store.includeSections.filter((x) => x && x).join(',');


    css = `
        div.ace-line:is([tag="h1"],[tag="h2"],[tag="h3"],[tag="h4"],[tag="h5"],[tag="h6"]){
          pointer-events: none !important;
          -webkit-user-modify: read-only;
          -moz-user-modify: read-only;
          user-modify: read-only;
          cursor: default;
        }

        div.ace-line{
          position: relative;
        }

        div.ace-line:not(:is(${cssSectionSelecrots})) *   {
          visibility: hidden;
          height:0;
          display:none!important;
        }

        div.ace-line:is(${cssSectionSelecrots}):after,
        div.ace-line:is(${cssSectionSelecrots}):before{
          position: relative;
          font-size: 1.5em;
          height: 1em;
          border: 0;
          width: 114%;
        }

        div.ace-line:not(:is(${cssSectionSelecrots})):after,
        div.ace-line:not(:is(${cssSectionSelecrots})):before,
        div.ace-line:not(:is(${cssSectionSelecrots})):after,
        div.ace-line:not(:is(${cssSectionSelecrots})):before{
          content: "";
          display: block;
          position: absolute;
          left: 0;
          right: 0;
          background-size: 2em 100%;
          height: 50px;
          width: calc(114% + 0px);
          left: 50%;
          transform: translate(-50%,-40px)!important;
        }

        // div.ace-line:not(:is(${cssSectionSelecrots})):after,
        // div.ace-line:not(:is(${cssSectionSelecrots})):before{
        //   -webkit-filter: drop-shadow(hsla(0, 0%, 80%, 0.2) 0px 0px 10px);
        // }

        // div.ace-line:not(:is(${cssSectionSelecrots})):after,
        // div.ace-line:not(:is(${cssSectionSelecrots})):before{
        //   transform: translateY(-20px);
        // }

        div.ace-line:not(:is(${cssSectionSelecrots})):after{
          background-position: calc(50% - -4em);
          background-image:
          linear-gradient(315deg, #fff 30%, transparent 30%),
          linear-gradient(45deg, #fff 30%, transparent 30%);
        }

        div.ace-line:not(:is(${cssSectionSelecrots})):before{
          background-position: calc(50% - 1em);
          background-image:
          linear-gradient(135deg, #fff 30%, transparent 30%),
          linear-gradient(225deg, #fff 30%, transparent 30%);
          background-color: #e5e7e8;
        }

        .dvd {
          background-image:
          linear-gradient(135deg, #ddd 30%, transparent 30%),
          linear-gradient(225deg, #ddd 30%, transparent 30%);
        }

        div.ace-line:not(:is(${cssSectionSelecrots})){ margin-top:40px; }
        div.ace-line:not(:is(${cssSectionSelecrots})){ margin-bottom:40px; }

        div.ace-line:heading { color:red }
      `;

    Helper.$bodyAceOuter()
        .find('iframe')
        .contents()
        .find('head #customHeader')
        .html(css);

    // if ep_table_of_contents is avilabel filter the list of headers also
    epTableOfContentsPlugin(cssSectionSelecrots);

    Helper.innerSkeleton('hide');
    Helper.updateHeaderList(null, Store.includeSections);

    if (callback) callback();
  };

  const applyFilter = (filter = {}, targetPath) => {
    const filters = Array.from(Store.filterList.values());
    window.softReloadLRHAttributes();
    window.history.pushState(
        {type: 'filter', filter, filterList: filters, targetPath, target: 'filter'},
        document.title,
        targetPath
    );
    Store.filteredHeaders = [];
    Store.includeSections = [];
    setTimeout(() => {
      Helper.updateHeaderList(() => {
        appendCssFilter(null, targetPath);
      });
    }, 500);

    if ($('body').hasClass('mobileView')) {
      const slugs = Helper.getPadSlugs();
      if (slugs.length === 0) return;

      const notify = $('body').find('.notify.filterApply');
      if (notify.length > 0) notify.remove();

      $('body').append(`
        <div class="notify filterApply active">${slugs.length === 1 ? 'Filter' : 'Filters'} applied</div>
      `);

      setTimeout(() => {
        $('.notify.filterApply').fadeOut().remove();
      }, 6000);
    }
  };


  if ($('body').hasClass('mobileView')) {
    $('#tableOfContentsModal .header .menue').append(`
      <button id="btnOpenFilterModal">
        <svg width="394pt" height="394pt" viewBox="-5 0 394 394">
          <path d="m367.82 0h-351.26c-6.1992-0.011719-11.879 3.4492-14.711 8.9609-2.8711 5.5859-2.3672 12.312 1.3008 17.414l128.69 181.29c0.042968 0.0625 0.089843 0.12109 0.13281 0.18359 4.6758 6.3125 7.207 13.961 7.2188 21.816v147.8c-0.027344 4.375 1.6914 8.582 4.7734 11.688 3.0859 3.1016 7.2812 4.8516 11.656 4.8516 2.2227-0.003906 4.4258-0.44531 6.4805-1.3008l72.312-27.57c6.4766-1.9805 10.777-8.0938 10.777-15.453v-120.02c0.011719-7.8555 2.543-15.504 7.2148-21.816 0.042968-0.0625 0.089844-0.12109 0.13281-0.18359l128.69-181.29c3.668-5.0977 4.1719-11.82 1.3008-17.406-2.8281-5.5156-8.5117-8.9766-14.707-8.9648z"></path>
        </svg>
      </button>
    `);
    const filterModal = $('#filterMobileView').tmpl();
    $('#filterHeadersModal .content').append(filterModal);
  } else {
    const headerViewTemplate = $('#filterViewTemplate').tmpl();
    $('body').append(headerViewTemplate);
  }

  $(document).on('touchstart click', '.btnFiltersSection', function () {
    $(this).parent().find('button').removeClass('active');
    $(this).addClass('active');
    $('.addSections').hide();
    $('.filtersSection').show();
  });

  $(document).on('touchstart click', '.btnAddsSection', function () {
    $(this).parent().find('button').removeClass('active');
    $(this).addClass('active');
    $('.filtersSection').hide();
    $('.addSections').show();
    setTimeout(() => $('.addSections input#filter_name').focus().select(), 500);
  });

  $(document).on('click', '#btnOpenFilterModal', () => {
    $('#filterHeadersModal').ndModal();
  });

  $(document).on('click', '.section_filterList ul li .filter_name', function () {
    $(this).closest('li')
        .find('.btn_filter_act').trigger('click');
  });

  $(document).on('click', '.btn_filter_act[active="true"]', function () {
    Helper.innerSkeleton('show');
    const filterId = $(this).attr('filter-id');
    const filter = Store.filterList.get(filterId);
    const currentPath = location.pathname;
    const slugIndex = currentPath.split('/').indexOf(filter.slug);
    const newPath = currentPath.split('/');
    newPath.splice(slugIndex, 1);
    let targetPath = newPath.join('/');
    if (targetPath.length === 0) targetPath = '/';

    if (!filter) return false;

    Helper.filterRowActivation(this, 'deactive');
    applyFilter(filter, targetPath);
  });

  $(document).on('click', '.btn_filter_act[active="false"]', function () {
    Helper.innerSkeleton('show');
    const filterId = $(this).attr('filter-id');
    const filter = Store.filterList.get(filterId);
    const currentPath = location.pathname.split('/');
    currentPath.push(filter.slug);
    if (currentPath[0] === '' && currentPath[1] === '') currentPath.shift();
    const targetPath = currentPath.join('/');

    window.history.pushState(
        {
          type: 'filter',
          filter,
          filterList: Array.from(Store.filterList.values()),
          targetPath,
          target: 'filter',

        },
        filter.name
    );
    Helper.filterRowActivation(this, 'active');
    applyFilter(filter, targetPath);
  });

  // if history state has change fire joinQueryString
  document.addEventListener('onPushState', (event) => {
    const {state} = event.detail;
    if (state.type === 'hyperLink') {
      const href = state.href;
      let targetPath = new URL(href);
      targetPath = targetPath.pathname;
      if (!targetPath) return;

      if (state.target && state.target === 'filter') Helper.innerSkeleton('show');

      if (Store.filterList.size === 0) {
        socket.emit('getFilterList', clientVars.padId, Helper.getPadSlugs(), (list) => {
          list.forEach((filter) => {
            if (!Store.filterList.has(filter.id)) Store.filterList.set(filter.id, filter);
          });
          applyFilter(null, targetPath);
        });
      } else {
        applyFilter(null, targetPath);
      }
    }
  });

  if (clientVars.padId !== clientVars.padView) {
    Helper.innerSkeleton('show');

    setTimeout(() => {
      Helper.updateHeaderList((headerContetnts) => {
        socket.emit('getFilterList', clientVars.padId, Helper.getPadSlugs(), (list) => {
          list.forEach((filter) => {
            if (!Store.filterList.has(filter.id)) Store.filterList.set(filter.id, filter);
          });

          const slug = location.pathname.split('/').pop();
          const filter = list.find((x) => x.slug === slug);

          window.history.pushState({type: 'filter', filter, filterList: list}, document.title);
          appendCssFilter();
        });
      });
    }, 1000);
  } else {
    Helper.innerSkeleton('hide');
  }
};
