const _ = require('underscore')
const slugify = require('./slugify')
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString
const $bodyAceOuter = () => $(document).find('iframe[name="ace_outer"]').contents()

exports.aceEditorCSS = () => {
  const version = clientVars.headerView.version || 1
  return [`ep_headerview/static/css/innerLayer.css?v=${version}`]
}

exports.postAceInit = (hookName, context) => {
  clientVars.ep_headerview = {}
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
  let includeSections = []
  const htags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  const undoTimeList = {}
  const filterList = new Map()
  let filteredHeaders = []

  // append custom style element to the pad inner.
  $bodyAceOuter()
    .find('iframe')
    .contents()
    .find('head')
    .append('<style id="customHeader"></style>')

  const doesFilterExist = (inputFilterVal) => {
    if (!inputFilterVal) return false

    const filterUrl = inputFilterVal.length > 0 ? slugify(inputFilterVal, { lower: true, strict: true }) : ''

    const currentPath = location.pathname.split('/')
    const path = `${location.pathname}/${filterUrl}`
    const doesHaveP = location.pathname.split('/').indexOf('p') > 0
    const urlPrefix = path.split('/').splice((doesHaveP ? 3 : 2), currentPath.length - 1)

    const filters = Array.from(filterList.values())

    const diffPass = (doesHaveP ? '/p/' : '') + `${clientVars.padId}/${urlPrefix.join('/')}`

    return filters.length <= 0 ? false : !!filters.find(e => diffPass === e.path)
  }

  const doesFilterUrlExist = (slug) => {
    const filters = Array.from(filterList.values())
    const path = `${location.pathname}/${slug}`
    return filters.length <= 0 ? false : !!filters.find(e => (path === e.path))
  }

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

    includeSections = includeSections.filter(x => x && x).join(',')

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
          height: 50px;
          width: calc(114% + 0px);
          left: 50%;
          transform: translate(-50%,-40px)!important;
        }

        // div.ace-line:not(:is(${includeSections})):after,
        // div.ace-line:not(:is(${includeSections})):before{
        //   -webkit-filter: drop-shadow(hsla(0, 0%, 80%, 0.2) 0px 0px 10px);
        // }

        // div.ace-line:not(:is(${includeSections})):after,
        // div.ace-line:not(:is(${includeSections})):before{
        //   transform: translateY(-20px);
        // }

        div.ace-line:not(:is(${includeSections})):after{
          background-position: calc(50% - -4em);
          background-image:
          linear-gradient(315deg, #fff 30%, transparent 30%),
          linear-gradient(45deg, #fff 30%, transparent 30%);
        }

        div.ace-line:not(:is(${includeSections})):before{
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

        div.ace-line:not(:is(${includeSections})){ margin-top:40px; }
        div.ace-line:not(:is(${includeSections})){ margin-bottom:40px; }

        div.ace-line:heading { color:red }
      `

    $bodyAceOuter()
      .find('iframe')
      .contents()
      .find('head #customHeader')
      .html(css)

    if (callback) callback()
  }

  const evaluateSearchResult = (value, callback) => {
    const val = value
    if (!val || val.length <= 0) return false
    const regEx = new RegExp(val, 'gi')
    const results = headerContetnts.filter((x) => x.text.match(regEx)) || []

    const filterURl = $('#filter_url').val()
    if (doesFilterExist(value) && doesFilterUrlExist(filterURl)) {
      $('.btn_createFilter').removeClass('active').attr('disabled', true)
      console.info('[headerview]: filter is exists! try andother filter name')
      return false
    }

    if (results.length) {
      $('.btn_createFilter').attr('disabled', false).addClass('active')
    } else {
      $('.btn_createFilter').removeAttr('disabled').removeClass('active')
    }

    $('.filterNumResults').text(results.length)

    if (callback) callback(results)
  }

  const updateHeaderList = (callback, selectedSections = []) => {
    let headers

    if (selectedSections.length) {
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
        lastFilter: false,
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

    $('.modal_filter .totalHeader').text(headerContetnts.length)

    if (callback) callback(headerContetnts)
  }

  const searchResult = _.debounce(evaluateSearchResult, 200)

  // ================>>>><<<<================== //
  // ================>>>><<<<================== //

  if (clientVars.padId !== clientVars.padView) {
    setTimeout(() => {
      updateHeaderList((headerContetnts) => {
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
              evaluateSearchResult(filter.name, (result) => {
                appendCssFilter()
              })
            })
          } else {
            window.history.pushState({ filter, filterList: list }, document.title)
            evaluateSearchResult(filter.name, (result) => {
              appendCssFilter()
            })
          }
        })
      })
    }, 1000)
  }

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
    $(`.section_filterList ul li.row_${filter.id}`).remove()
    if (!$('.section_filterList ul li').length) {
      $('.section_filterList ul').append('<li class="filterEmpty"><p>There is no filter <br> create the first filter</p></li>')
    }
    filterList.delete(filter.id)
  }

  const appendFilter = (filter) => {
    let active = false
    let highlight = false

    if (clientVars.padId !== clientVars.padView) {
      const activatedSlug = location.pathname.split('/')
      highlight = activatedSlug.includes(filter.slug)
      active = activatedSlug.includes(filter.slug)
    }

    if (!filterList.has(filter.id)) filterList.set(filter.id, filter)
    const newFilter = $('#filter_listItem').tmpl({
      filter: filterList.get(filter.id),
      active,
      highlight
    })

    if ($('.section_filterList ul li').length) { $('.section_filterList ul .filterEmpty').remove() }

    if (!$(`.section_filterList ul li.row_${filter.id}`).length) {
      $('.section_filterList ul')
        .append(`<li class="row_${filter.id}" active="${active}" highlight="${highlight}">${$(newFilter).html()}</li>`)
    }
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
      clientVars.ep_headerview.filterList = list
      list.forEach((row) => {
        if (!filterList.has(row.id)) filterList.set(row.id, row)
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

    if (doesFilterUrlExist(filterUrl)) {
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
      appendFilter(res)
    })

    // clear form
    $('#filter_name, #filter_url').val('')
    $('.btn_createFilter').removeClass('active').attr('disabled', true)
    $('.filterNumResults').text(0)
  }

  $('.btn_createFilter').on('click', createNewFilter)

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
        removeFilter(filter)
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
      searchResult(inputText)
    })
    .focusout(function () {
      const inputText = $(this).val()
      if (inputText.length > 0) $('#filter_url').val(slugify(inputText, { lower: true, strict: true }))
      $('.filterNumResults').removeClass('active')
    })
    .keyup(function () {
      const inputText = $(this).val()
      searchResult(inputText)
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
      if (!doesFilterUrlExist(val)) {
        $('.btn_createFilter').addClass('active').removeAttr('disabled')
      } else {
        $('.btn_createFilter').removeClass('active').attr('disabled', true)
      }
    })
}
