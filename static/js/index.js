const _ = require('underscore')
const slugify = require('./slugify')
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString
const Helper = require('./helper')
let {
  headerContetnts,
  includeSections,
  undoTimeList,
  filterList,
  filteredHeaders
} = require('./store')
const $bodyAceOuter = () => $(document).find('iframe[name="ace_outer"]').contents()
let socket

exports.aceEditorCSS = () => {
  const version = clientVars.headerView.version || 1
  return [`ep_headerview/static/css/innerLayer.css?v=${version}`]
}

const clearFilterListSection = () => {
  $('.section_filterList ul li').remove()
  $('.section_filterList ul').append('<li class="filterEmpty"><p>There is no filter <br> create the first filter</p></li>')
}

const createNewFilter = () => {
  const filterName = $('#filter_name').val()
  const filterUrl = $('#filter_url').val()

  const filterId = randomString()

  const currentPath = location.pathname.split('/')
  const path = `${location.pathname}/${filterUrl}`
  const doesHaveP = location.pathname.split('/').indexOf('p') > 0
  const urlPrefix = path.split('/').splice((doesHaveP ? 3 : 2), currentPath.length - 1)

  const prevPath = path.split('/')
  prevPath.pop()

  if (!filterName || !filterUrl) return false

  if (Helper.doesFilterUrlExist(filterUrl)) {
    console.info('[headerview]: The filter already exists')
    return false
  }

  const filter = {
    name: filterName,
    id: filterId,
    slug: filterUrl,
    root: location.pathname,
    path: `${location.pathname}/${filterUrl}`,
    prevPath: prevPath.join('/'),
    url: urlPrefix
  }

  // submit filter
  socket.emit('addNewFilter', clientVars.padId, filter, (res) => {
    Helper.appendFilter(res)
  })

  // clear form
  $('#filter_name, #filter_url').val('')
  $('.btn_createFilter').removeClass('active').attr('disabled', true)
  $('.filterNumResults').text(0)
}

// =======>>>

const initSocket = () => {
  const loc = document.location
  const port = loc.port === '' ? loc.protocol === 'https:' ? 443 : 80 : loc.port
  let socketURL = `${loc.protocol}//${loc.hostname}:${port}`

  socketURL = `${socketURL}/headerview`

  socket = io.connect(socketURL, {
    query: `padId=${clientVars.padId}`
  })

  socket.on('disconnect', (reason) => {
    console.error('[headerView]: socket disconnection, reason:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('[headerView]: socket connect_error:', error)
  })

  socket.on('addNewFilter', Helper.appendFilter)

  socket.on('removeFilter', Helper.removeFilter)
}

const appendCustomStyleTag = () => {
  // padOuter
  $(document)
    .find('head')
    .append('<style id="tocCustomHeader"></style>')

  // padInner
  $bodyAceOuter()
    .find('iframe')
    .contents()
    .find('head')
    .append('<style id="customHeader"></style>')
}

const eventListner = () => {
  $(window).resize(_.debounce(Helper.adoptFilterModalPosition, 250))

  $('.btn_createFilter').on('click', createNewFilter)

  $('button#btn_filterView').on('click', () => {
    socket.emit('getFilterList', clientVars.padId, (list) => {
      clearFilterListSection()
      clientVars.ep_headerview.filterList = list
      list.forEach((row) => {
        if (!filterList.has(row.id)) filterList.set(row.id, row)
        if (!row) return
        Helper.appendFilter(row)
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
    Helper.updateHeaderList(null, includeSections)
  })

  $(document).on('click', '.btn_filter_remove', function () {
    const filterId = $(this).attr('filter-id')
    const active = $(this).attr('active')
    const highlight = $(this).attr('highlight')
    const filter = filterList.get(filterId)

    const undoRow = $('#filter_remove_undo').tmpl({
      filter,
      active,
      highlight
    })

    $(`.section_filterList ul li.row_${filterId}`).html(undoRow)

    undoTimeList[filterId] = setTimeout(() => {
      delete undoTimeList[filterId]
      socket.emit('removeFilter', clientVars.padId, filter, (res) => {
        console.info(`[headerview]: filter has been removed; id ${filterId}, res: ${res}, filter:`, filter)
        Helper.removeFilter(filter)
      })
    }, 2000)
  })

  $(document).on('click', '.btn_undoDelete', function () {
    const filterId = $(this).attr('filter-id')
    const active = $(this).attr('active')
    const highlight = $(this).attr('highlight')

    clearTimeout(undoTimeList[filterId])
    delete undoTimeList[filterId]

    const rowFilter = $('#filter_listItem').tmpl({
      filter: filterList.get(filterId),
      active,
      highlight
    })

    $(`.section_filterList ul li.row_${filterId}`)
      .html(`<li class="row_${filterId}" active="${active}" highlight="${highlight}">${$(rowFilter).html()}</li>`)
  })

  $(document).on('click', '.btn_filter_act[active="false"]', function () {
    const filterId = $(this).attr('filter-id')
    const filter = filterList.get(filterId)
    window.history.pushState({ filter, filterList: Array.from(filterList.values()) }, filter.name)
    const currentPath = location.pathname
    const targetPath = `${currentPath}/${filter.slug}`
    window.location.href = targetPath
  })

  $(document).on('click', '.btn_filter_act[active="true"]', function () {
    const filterId = $(this).attr('filter-id')
    const filter = filterList.get(filterId)

    const currentPath = location.pathname
    const slugIndex = currentPath.split('/').indexOf(filter.slug)
    const newPath = currentPath.split('/')
    newPath.splice(slugIndex, 1)
    const targetPath = newPath.join('/')

    if (filter) {
      window.history.pushState({ filter, filterList: Array.from(filterList.values()) }, filter.name)
      window.location.href = targetPath
    }
  })

  $('.modal_filter  input#filter_name')
    .focusin(function () {
      const inputText = $(this).val()
      $('.filterNumResults').addClass('active')
      Helper.searchResult(inputText)
    })
    .focusout(function () {
      const inputText = $(this).val()
      if (inputText.length > 0) $('#filter_url').val(slugify(inputText, { lower: true, strict: true }))
      $('.filterNumResults').removeClass('active')
    })
    .keyup(function () {
      const inputText = $(this).val()
      Helper.searchResult(inputText)
      if (inputText.length > 0) $('#filter_url').val(slugify(inputText, { lower: true, strict: true }))
    })

  $('#filter_url').focusout(function () {
    const val = $(this).val()
    if (val.length > 0) $(this).val(slugify(val, { lower: true, strict: true }))
  })
    .focusin(function () {
      $('.filterNumResults').addClass('active')
    })
    .focusout(function () {
      $('.filterNumResults').removeClass('active')
    })
    .keyup(function () {
      const val = $(this).val()
      if (!Helper.doesFilterUrlExist(val)) {
        $('.btn_createFilter').addClass('active').removeAttr('disabled')
      } else {
        $('.btn_createFilter').removeClass('active').attr('disabled', true)
      }
    })
}

exports.postAceInit = (hookName, context) => {
  clientVars.ep_headerview = {}
  initSocket()
  appendCustomStyleTag()
  eventListner()

  const createCssFilterForParentHeaders = (tagIndex, titleId, section, lrhSectionId) => {
    return `[sectionid='${lrhSectionId}'],[titleid='${titleId}'][lrh${tagIndex}='${section.lrhMark[tagIndex]}']`
  }

  const createCssFilterForChildeHeaders = (tagIndex, titleId, section, lrhSectionId) => {
    let results = ''
    if (section.lastFilter) {
      results = `[sectionid='${lrhSectionId}'],[titleid='${titleId}'][lrh${tagIndex}='${section.lrhMark[tagIndex]}']`
    } else {
      results = `[sectionid='${lrhSectionId}']`
    }
    return results
  }

  const epTableOfContentsPlugin = (includeSections) => {
    const plugins = clientVars.plugins.plugins || {}
    if (!plugins.hasOwnProperty('ep_table_of_contents')) return false
    const css = `
      #tocItems .tocItem{
        display: none;
      }
      #tocItems .tocItem:is(${includeSections}) {
        display: flex;
      }
    `
    $(document).find('head #tocCustomHeader').html(css)
  }

  const appendCssFilter = (callback) => {
    let css = ''
    let bucketSearchResult = []
    const filterIncludesSections = []
    const slugsScore = {}
    const sectionsContaintSlugs = []

    const currentPath = location.pathname.split('/')
    const doesHaveP = location.pathname.split('/').indexOf('p') > 0
    const filterURL = [...currentPath].splice((doesHaveP ? 3 : 2), currentPath.length - 1)

    // Give score to the slugs and reorder the filter for nested search
    filterURL.forEach((slug, index) => {
      const filter = Array.from(filterList.values()).find(x => x.slug === slug)
      const regEx = new RegExp(filter.name, 'gi')

      if (!slugsScore[slug]) slugsScore[slug] = { text: filter.name, count: 0, sumTagIndex: 0, score: 0 }
      // TODO: [performance-issue]: change this loop cycle
      const sectionsSlugs = headerContetnts.filter((x) => {
        const is = x.text.match(regEx)
        if (is) {
          slugsScore[slug].count += 1
          slugsScore[slug].sumTagIndex += x.tag
        }
        return is
      })
      sectionsContaintSlugs.push(...sectionsSlugs)
    })

    const slugsScoreKeys = Object.keys(slugsScore)

    // Calculate the slug score
    slugsScoreKeys.forEach(slug => {
      const count = slugsScore[slug].count
      const sumTagIndex = slugsScore[slug].sumTagIndex
      slugsScore[slug].score = sumTagIndex / count
    })

    // sort slug by score
    const sortedSlugs = slugsScoreKeys.sort((a, b) => slugsScore[a].score - slugsScore[b].score)

    for (const [index, slug] of sortedSlugs.entries()) {
      const regEx = new RegExp(slugsScore[slug].text, 'gi')
      let results = []

      if (bucketSearchResult.length === 0) {
        results = headerContetnts.filter((x) => x.text.match(regEx))
        filteredHeaders.push(...results)
      } else {
        const lrh1IdList = bucketSearchResult.map(x => x.lrh1)
        const titleIdList = bucketSearchResult.map(x => x.titleId)

        let newBucketSearchResult = headerContetnts.filter(x => titleIdList.includes(x.titleId))

        if (!lrh1IdList.some(x => x === undefined)) { newBucketSearchResult = headerContetnts.filter(x => lrh1IdList.includes(x.lrh1)) }

        results = newBucketSearchResult.filter((x) => x.text.match(x.text.match(regEx)))
        filteredHeaders.push(...results)

        if (index === sortedSlugs.length - 1) { results = results.map(x => ({ ...x, lastFilter: true })) }

        filterIncludesSections.push(...results)
        // save every last slug result
        if (index >= 1) bucketSearchResult = []
      }

      bucketSearchResult.push(...results)
    }

    // filter by parent // limite the search result by title header Id
    // I want this line
    const otherParentHeader = filteredHeaders.filter(x => x.tag === 1).map(x => x.titleId)
    if (filterURL.length > 1) filteredHeaders = filteredHeaders.filter(x => otherParentHeader.includes(x.titleId))

    // if just one filter name has activated
    if (filterURL.length === 1) {
      for (const section of filteredHeaders) {
        const tagIndex = section.tag
        const titleId = section.titleId
        const includeParts = section.lrhMark
          .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
          .map((lrhSectionId) => {
            return createCssFilterForParentHeaders(tagIndex, titleId, section, lrhSectionId)
          })

        includeSections.push(...includeParts)
      }

      for (const section of filteredHeaders) {
        const tagIndex = section.tag
        const titleId = section.titleId

        const includeParts = section.lrhMark
          .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
          .map((lrhSectionId) => {
            return createCssFilterForChildeHeaders(tagIndex, titleId, section, lrhSectionId)
          })

        includeSections.push(...includeParts)
      }
    } else {
      for (const section of filterIncludesSections) {
        const tagIndex = section.tag
        const titleId = section.titleId

        const includeParts = section.lrhMark
          .filter((x, lrnhIndex) => x && (lrnhIndex) <= tagIndex)
          .map((lrhSectionId) => {
            return createCssFilterForChildeHeaders(tagIndex, titleId, section, lrhSectionId)
          })

        includeSections.push(...includeParts)
      }
    }

    const cssSectionSelecrots = includeSections.filter(x => x && x).join(',')

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
      `

    $bodyAceOuter()
      .find('iframe')
      .contents()
      .find('head #customHeader')
      .html(css)

    // if ep_table_of_contents is avilabel filter the list of headers also
    epTableOfContentsPlugin(cssSectionSelecrots)

    if (callback) callback()
  }

  if (clientVars.padId !== clientVars.padView) {
    setTimeout(() => {
      Helper.updateHeaderList((headerContetnts) => {
        socket.emit('getFilterList', clientVars.padId, (list) => {
          list.forEach(filter => {
            if (!filterList.has(filter.id)) filterList.set(filter.id, filter)
          })

          const slug = location.pathname.split('/').pop()
          const filter = list.find((x) => x.slug === slug)
          // if filter does not exist, create a new filter
          if (!filter) {
            const currentPath = location.pathname.split('/')
            const doesHaveChildren = currentPath.lastIndexOf(clientVars.padName) > 0

            const prevPath = [...currentPath]
            if (doesHaveChildren) prevPath.pop()

            const doesHaveP = location.pathname.split('/').indexOf('p') > 0

            const filterURL = [...currentPath].splice((doesHaveP ? 3 : 2), currentPath.length - 1)

            if(filterURL.length === 0) return false

            const filterId = randomString()

            const filter = {
              name: clientVars.padName,
              id: filterId,
              slug: [...currentPath].pop(),
              root: location.pathname,
              path: `${location.pathname}`,
              prevPath: prevPath.join('/'),
              url: filterURL,
              ChildrenPath: []
            }

            filterList.set(filter.id, filter)

            socket.emit('addNewFilter', clientVars.padId, filter, (res) => {
              window.history.pushState({ filter, filterList: list }, document.title)
              Helper.evaluateSearchResult(filter.name, (result) => {
                appendCssFilter()
              })
            })
          } else {
            window.history.pushState({ filter, filterList: list }, document.title)
            Helper.evaluateSearchResult(filter.name, (result) => {
              appendCssFilter()
            })
          }
        })
      })
    }, 1000)
  }
}
