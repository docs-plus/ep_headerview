const _ = require('underscore')
const slugify = require('./slugify')
const {
  headerContetnts,
  filterList

} = require('./store')
const $bodyAceOuter = () => $(document).find('iframe[name="ace_outer"]').contents()
const htags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// remove filter from filter modal
const removeFilter = (filter) => {
  $(`.section_filterList ul li.row_${filter.id}`).remove()
  if (!$('.section_filterList ul li').length) {
    $('.section_filterList ul').append('<li class="filterEmpty"><p>There is no filter <br> create the first filter</p></li>')
  }
  filterList.delete(filter.id)
}

// add filter to filter modal
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

  if ($(`.section_filterList ul li.row_${filter.id}`).length) return false

  if (active || highlight) {
    $('.section_filterList ul')
      .prepend(`<li class="row_${filter.id}" active="${active}" highlight="${highlight}">${$(newFilter).html()}</li>`)
  } else {
    $('.section_filterList ul')
      .append(`<li class="row_${filter.id}" active="${active}" highlight="${highlight}">${$(newFilter).html()}</li>`)
  }
}

const adoptFilterModalPosition = () => {
  const pos = $('button#btn_filterView').offset()
  const modalWith = $('.modal_filter').outerWidth(true)
  const btnFilterWith = $('button#btn_filterView').outerWidth(true)

  $('.modal_filter')
    .css({ left: pos.left - modalWith + btnFilterWith })
}

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

  headerContetnts.splice(0, headerContetnts.length)
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

const doesHaveP = () => location.pathname.split('/').indexOf('p') > 0

module.exports = {
  removeFilter,
  appendFilter,
  adoptFilterModalPosition,
  doesFilterExist,
  doesFilterUrlExist,
  evaluateSearchResult,
  searchResult,
  updateHeaderList,
  doesHaveP
}
