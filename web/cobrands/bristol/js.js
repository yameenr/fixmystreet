(function(){

var options = {
    wfs_url: "https://maps.bristol.gov.uk/arcgis/services/ext/FixMyStreetSupportData/MapServer/WFSServer",
    wfs_feature: "COD_ASSETS_POINT",
    max_resolution: 2.388657133579254,
    min_resolution: 0.00001,
    attributes: {
        asset_id: 'COD_ASSET_ID',
        usrn: 'COD_USRN',
        xref: 'COD_XREF',
        yref: 'COD_YREF'
    },
    geometryName: 'SHAPE'
};

$(fixmystreet.add_assets($.extend({}, options, {
    wfs_feature: "COD_ASSETS_AREA",
    asset_category: "Bridges/Subways",
    asset_item: 'bridge/subway'
})));

$(fixmystreet.add_assets($.extend({}, options, {
    asset_category: "Gully/Drainage",
    asset_item: 'gully',
    filter_key: 'COD_ASSET_TYPE',
    filter_value: 'GULLY'
})));

$(fixmystreet.add_assets($.extend({}, options, {
    asset_category: "Grit Bins",
    asset_item: 'grit bin',
    filter_key: 'COD_ASSET_TYPE',
    filter_value: 'GRITBIN'
})));

})();
