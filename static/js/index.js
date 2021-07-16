const _ = require('underscore')
const slugify = require('./slugify')
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString

const $bodyAceOuter = () => $(document).find('iframe[name="ace_outer"]').contents()

exports.aceEditorCSS = () => {
  const version = clientVars.headerView.version || 1
  return [`ep_headerview/static/css/innerLayer.css?v=${version}`]
}

// Bind the event handler to the toolbar buttons
exports.postAceInit = (hookName, context) => {
  const loc = document.location
  const port = loc.port === '' ? loc.protocol === 'https:' ? 443 : 80 : loc.port
  let socketURL = `${loc.protocol}//${loc.hostname}:${port}`

  socketURL = `${socketURL}/headerview`

  const socket = io.connect(socketURL, {
    query: `padId=${clientVars.padId}`
  })

  socket.on('disconnect', (reason) => {
    console.error('[headerView]: socket disconnection, reason:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('[headerView]: socket connect_error:', error)
  })

  /** ========================= **/

  let headerContetnts = []
  let filterResult = []
  let includeSections = []
  // let filterValue = ''
  const htags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  // let activeFilter
  const undoTimeList = {}
  let filterNumResults = 0;
  let filterUrlPrefix = []
  const filterList = new Map()

  // append custom style element to the pad inner.
  $bodyAceOuter()
    .find('iframe')
    .contents()
    .find('head')
    .append('<style id="customHeader"></style>')

  const clearCssFilter = () => $bodyAceOuter()
    .find('iframe')
    .contents()
    .find('head #customHeader')
    .html('')

  const appendCssFilter = () => {
    let css = ''


    for (const section of filterResult) {
      const tagIndex = section.tag
      const titleId = section.titleId
      includeSections.push(`[sectionid='${titleId}']`)

      const includeParts = section.lrhMark
        .filter((x, lrnhIndex) => x && lrnhIndex <= tagIndex)
        .map((x) => `[sectionid='${x}'],[titleid='${titleId}'][lrh${tagIndex - 1}='${section.lrhMark[tagIndex - 1]}'][lrh${tagIndex}='${section.lrhMark[tagIndex]}']`)

      includeSections.push(...includeParts)
    }

    includeSections = includeSections.join(',')


    console.log(includeSections)



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

        div.ace-line:not(:is(${includeSections})) *   {
          visibility: hidden;
          height:0;
          display:none!important;
        }

        div.ace-line:is(${includeSections}):after,
        div.ace-line:is(${includeSections}):before{
          position: relative;
          font-size: 1.5em;
          height: 1em;
          border: 0;
          width: 114%;
        }
        div.ace-line:not(:is(${includeSections})):after,
        div.ace-line:not(:is(${includeSections})):before,
        div.ace-line:not(:is(${includeSections})):after,
        div.ace-line:not(:is(${includeSections})):before{
          content: "";
          display: block;
          position: absolute;
          left: 0;
          right: 0;
          background-size: 2em 100%;
          height: 16px;
          width: 122%;
          left: 50%;
          transform: translate(-50%,-30px)!important;
        }

        // div.ace-line:not(:is(${includeSections})):after,
        // div.ace-line:not(:is(${includeSections})):after{
        //   -webkit-filter: drop-shadow(hsla(0, 0%, 80%, 0.2) 0px 0px 10px);
        // }

        div.ace-line:not(:is(${includeSections})):after,
        div.ace-line:not(:is(${includeSections})):before{
          transform: translateY(-20px);
        }

        div.ace-line:not(:is(${includeSections})):after,
        div.ace-line:not(:is(${includeSections})):after{
          background-image:
          linear-gradient(135deg, hsla(210deg 20% 95%) 30%, transparent 30%),
          linear-gradient(225deg, hsla(210deg 20% 95%) 30%, transparent 30%);
          background-position: -webkit-calc(50% - 1em);
          top: 0.5em;
        }

        div.ace-line:not(:is(${includeSections})):before,
        div.ace-line:not(:is(${includeSections})):before{
          background-image:
          linear-gradient(315deg, hsla(210deg 20% 95%) 30%, transparent 30%),
          linear-gradient(45deg, hsla(210deg 20% 95%) 30%, transparent 30%);
          background-position: 50%;
          top: -0.5em;
        }

        div.ace-line:not(:is(${includeSections})){ margin-top:30px; }
        div.ace-line:not(:is(${includeSections})){ margin-bottom:30px; }
      `

    $bodyAceOuter()
      .find('iframe')
      .contents()
      .find('head #customHeader')
      .html(css)
  }

  const evaluateSearchResult = (value, callback) => {
    // const activatedFilter = window.history.state === null ? null : window.history.state.filter
    // if (activatedFilter) activeFilter = activatedFilter

    console.log(value, "=-=->>", typeof value)

    const val = $(value).val() || value
    if (!val || val.length <= 0) return false
    const regEx = new RegExp(val, 'gi')
    const results = headerContetnts.filter((x) => x.text.match(regEx))
    const slug = val.length>0 ? slugify(val, { lower: true, strict: true }) : "";

    if (val && doesFilterExist(slug)) {
      // clear form
      $('.btn_createFilter').removeClass('active').attr('disable', true)
      $('.filterNumResults').text(0)
      console.info("[headerview]: filter is exists! try andother filter name")
      return false
    }

    if (results.length) {
      $('.btn_createFilter').attr('disabled', false).addClass('active')
    } else {
      $('.btn_createFilter').removeAttr('disabled').removeClass('active')
    }

    $('.filterNumResults').text( typeof value !== "string"? results.length : 0)

    if(filterUrlPrefix) $('.filter_urlPrefix').text(`${filterUrlPrefix.join("/")}/`)

    if (val.length && $('#filter_name').val().length) $('#filter_url').val(slugify(val, { lower: true, strict: true }))

    filterResult = results
    // filterValue = val
    if (callback) callback(results)
  }

  const updateHeaderList = (callback, selectedSections = []) => {

    let headers;

    console.log(selectedSections)

    if(selectedSections.length){
      headers = $bodyAceOuter()
      .find('iframe')
      .contents()
      .find(selectedSections)
      .find(':header')

    } else {
      headers = $bodyAceOuter()
        .find('iframe')
        .contents()
        .find(':header')
    }



    headerContetnts = []
    headers.each(function () {
      const text = $(this).text()
      const $parent = $(this).parent()
      const sectionId = $parent.attr('sectionid')
      const tag = htags.indexOf($parent.attr('tag'))
      const titleId = $parent.attr('titleid')

      const lrh0 = $parent.attr('lrh0')
      const lrh1 = $parent.attr('lrh1')
      const lrh2 = $parent.attr('lrh2')
      const lrh3 = $parent.attr('lrh3')
      const lrh4 = $parent.attr('lrh4')
      const lrh5 = $parent.attr('lrh5')
      const lrh6 = $parent.attr('lrh6')

      const result = {
        text,
        sectionId,
        tag,
        titleId,
        lrh1,
        lrhMark: [
          lrh0,
          lrh1,
          lrh2,
          lrh3,
          lrh4,
          lrh5,
          lrh6
        ]
      }

      headerContetnts.push(result)
    })

    console.log(headerContetnts)

    $('.modal_filter .totalHeader').text(headerContetnts.length)

    if (callback) callback(headerContetnts)
  }

  if (clientVars.padId !== clientVars.padView) {
    // const filterName = clientVars.padName || window.history.state.filter.name

    filterUrlPrefix = window.location.pathname.split("/")
    filterUrlPrefix = filterUrlPrefix.splice(3, filterUrlPrefix.length+1)

    setTimeout(() => {
      updateHeaderList((headerContetnts) => {
        socket.emit('getFilterList', clientVars.padId, (list) => {
          let filter = list.find((x) => x.path === location.pathname)
          console.log(filter, "=-=-=-=-sssss=-=-=-=-", list)
          // if filter does not exist, create a new filter
          if (!filter) {
            const currentPath = location.pathname.split("/")
            const doesHaveChildren = currentPath.lastIndexOf(clientVars.padName)

            let prevPath = currentPath
            if(!doesHaveChildren) prevPath.pop()

            let filterURL =  currentPath.splice(3, currentPath.length - 1)

            filterURL = filterURL.length ? filterURL : filterUrl

            const filter = {
              name: clientVars.padName,
              id: randomString(),
              root: location.pathname,
              path: `${location.pathname}`,
              prevPath: prevPath.join('/'),
              url: filterURL,
              ChildrenPath: []
            }

            socket.emit('addNewFilter', clientVars.padId, filter, (res) => {
              if (!window.history.state) window.history.pushState({ filter }, document.title)
              evaluateSearchResult(filter.name, (result) => {
                appendCssFilter()
              })
            })
          } else {
            if (!window.history.state) window.history.pushState({ filter }, document.title)
            evaluateSearchResult(filter.name, (result) => {
              appendCssFilter()
            })
          }
        })
      })
    }, 1000)
  }

  const searchResult = _.debounce(evaluateSearchResult, 300)

  $('.btn-clearInput').on('click', function () {
    $('#heading-view').val('')
    clearCssFilter()
    $(this).removeClass('active')
    $('#heading-result-msg').html('<p>Search through the headers</p>')
    updateHeaderList()
  })

  // ================>>>><<<<================== //
  // ================>>>><<<<================== //

  const adoptFilterModalPosition = () => {
    const pos = $('button#btn_filterView').offset()
    const modalWith = $('.modal_filter').outerWidth(true)
    const btnFilterWith = $('button#btn_filterView').outerWidth(true)

    $('.modal_filter')
      .css({ left: pos.left - modalWith + btnFilterWith })
  }

  $(window).resize(_.debounce(adoptFilterModalPosition, 250))

  const removeFilter = (filter) => {
    if (!$('.section_filterList ul li').length) {
      $('.section_filterList ul').append('<li class="filterEmpty"><p>There is no filter <br> create the first filter</p></li>')
    }
    $(`.section_filterList ul li.row_${filter.id}`).remove()
    filterList.delete(filter.id)
  }

  const highliteRowList = []
  const appendFilter = (filter) => {
    let active = false

    if (clientVars.padId !== clientVars.padView) {
      active = (window.history.state && window.history.state.filter.id === filter.id) || (window.history.state.filter.prevPath === filter.path) || highliteRowList.includes(filter.path)
    }

    if(!filterList.has(filter.id)) filterList.set(filter.id, filter)

    const newFilter = $('#filter_listItem').tmpl({
      filter: filterList.get(filter.id),
      active
    })

    if ($('.section_filterList ul li').length) $('.section_filterList ul .filterEmpty').remove()

    if (!$(`.section_filterList ul li.row_${filter.id}`).length) $('.section_filterList ul').append(`<li class="row_${filter.id}" active="${active}">${$(newFilter).html()}</li>`)
  }

  socket.on('addNewFilter', appendFilter)

  socket.on('removeFilter', removeFilter)

  const clearFilterListSection = () => {
    $('.section_filterList ul li').remove()
    $('.section_filterList ul').append('<li class="filterEmpty"><p>There is no filter <br> create the first filter</p></li>')
  }

  $('button#btn_filterView').on('click', () => {
    socket.emit('getFilterList', clientVars.padId, (list) => {
      clearFilterListSection()
      ;list.forEach((row) => {
        if(!filterList.has(row.id)) filterList.set(row.id, row)
        if (!row) return
        appendFilter(row)
      })
    })
  })

  $('button#btn_filterView, .modal_filter button.btn_closeModal').on('click', () => {
    const pos = $('button#btn_filterView').offset()
    const modalWith = $('.modal_filter').outerWidth(true)
    const btnFilterWith = $('button#btn_filterView').outerWidth(true)

    $('.modal_filter')
      .toggleClass('active')
      .css({ left: pos.left - modalWith + btnFilterWith })

    $('#btn_filterView').toggleClass('active')
    updateHeaderList(null, includeSections)
  })

  $('.modal_filter  input#filter_name')
    .focusin(function () {
      const inputText = $(this).val()
      $('.filterNumResults').addClass('active')
      searchResult(inputText)
    })
    .focusout(function () {
      $(this).val().length == 0 && $('#filter_url').val('')
      $('.filterNumResults').removeClass('active')
    })
    .keypress((event) => {})
    .keyup(function () {
      searchResult(this)
    })

  const doesFilterExist = (filterUrl) => [...filterList].filter((x) => x.filterUrl === filterUrl).length > 0

  $('.btn_createFilter').on('click', () => {
    const filterName = $('#filter_name').val()
    const filterUrl = $('#filter_url').val()

    if (!filterName) return false
    if (doesFilterExist(filterUrl)) {
      console.info("[headerview]: The filter already exists")
      return false
    }

    const currentPath = location.pathname.split("/")
    const doesHaveChildren = currentPath.lastIndexOf(clientVars.padName)

    let prevPath = currentPath
    if(!doesHaveChildren) prevPath.pop()

    const path = `${location.pathname}/${filterUrl}`

    let filterURL =  path.split('/').splice(3, currentPath.length - 1)

    filterURL = filterURL.length ? filterURL : [filterUrl]

    const filter = {
      name: filterName,
      id: randomString(),
      root: location.pathname,
      path: `${location.pathname}/${filterUrl}`,
      prevPath: prevPath.join('/'),
      url: filterURL,
      ChildrenPath: []
    }

    console.log(filter)

    // submit filter
    socket.emit('addNewFilter', clientVars.padId, filter, (res) => {
      console.log("btn creat new filter socket result", res)
      appendFilter(res)
    })

    // clear form
    $('#filter_name').val('')
    $('.btn_createFilter').removeClass('active').attr('disable', true)
    $('.filterNumResults').text(0)
  })

  $(document).on('click', '.btn_filter_remove', function () {
    const filterId = $(this).attr('filter-id')
    const active = $(this).attr('active')

    const undoRow = $('#filter_remove_undo').tmpl({
      filter: filterList.get(filterId),
      active
    })

    $(`.section_filterList ul li.row_${filterId}`).html(undoRow)

    undoTimeList[filterId] = setTimeout(() => {
      $(`.section_filterList ul li.row_${filterId}`).remove()
      delete undoTimeList[filterId]
      socket.emit('removeFilter', clientVars.padId, { filter: {id: filterId} }, (res) => {
        removeFilter(filterId)
      })
    }, 2000)

  })

  $(document).on('click', '.btn_undoDelete', function () {
    const filterId = $(this).attr('filter-id')
    const active = $(this).attr('active')

    clearTimeout(undoTimeList[filterId])
    delete undoTimeList[filterId]

    const rowFilter = $('#filter_listItem').tmpl({
      filter: filterList.get(filterId),
      active
    });

    $(`.section_filterList ul li.row_${filterId}`).html(`<li class="row_${filterId}">${$(rowFilter).html()}</li>`)
  })


  $(document).on('click', '.btn_filter_act[active="false"]', function () {

    const filterId = $(this).attr('filter-id')
    const filter = filterList.get(filterId)

    window.history.pushState({ filter }, filter.name, filter.path)
    window.location.href = filter.path
  })

  $(document).on('click', '.btn_filter_act[active="true"]', function() {
    const filterId = $(this).attr('filter-id')
    const filter = filterList.get(filterId)

    if(filter){
      window.history.pushState({ filter }, filter.name, filter.prevPath)
      window.location.href = filter.prevPath
    }
  })

  $('#filter_url').focusout(function () {
    const val = $(this).val()
    if (val.length>0) $(this).val(slugify(val, { lower: true, strict: true }))
  })
}
