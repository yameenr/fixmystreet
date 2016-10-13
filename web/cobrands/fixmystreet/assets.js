var fixmystreet = fixmystreet || {};

(function(){

var selected_feature = null;
var fault_popup = null;

function close_fault_popup() {
    if (!!fault_popup) {
        fixmystreet.map.removePopup(fault_popup);
        fault_popup.destroy();
        fault_popup = null;
    }
}

function asset_selected(e) {
    close_fault_popup();
    var lonlat = e.feature.geometry.getBounds().getCenterLonLat();

    // Check if there is a known fault with the light that's been clicked,
    // and disallow selection if so.
    var fault_feature = find_matching_feature(e.feature, this.fixmystreet.fault_layer);
    if (!!fault_feature) {
        fault_popup = new OpenLayers.Popup.FramedCloud("popup",
            e.feature.geometry.getBounds().getCenterLonLat(),
            null,
            "This fault (" + e.feature.attributes.n + ")<br />has been reported.",
            { size: new OpenLayers.Size(0, 0), offset: new OpenLayers.Pixel(0, 0) },
            true, close_fault_popup);
        fixmystreet.map.addPopup(fault_popup);
        get_select_control(this).unselect(e.feature);
        return;
    }

    // Set the extra field to the value of the selected feature
    $.each(this.fixmystreet.attributes, function (field_name, attribute_name) {
        var id = e.feature.attributes[attribute_name];
        $("#form_" + field_name).val(id);
    });

    // Hide the normal markers layer to keep things simple, but
    // move the green marker to the point of the click to stop
    // it jumping around unexpectedly if the user deselects street light.
    fixmystreet.markers.setVisibility(false);
    fixmystreet.markers.features[0].move(lonlat);

    // Need to ensure the correct coords are used for the report
    fixmystreet.maps.update_pin(lonlat);

    // Make sure the marker that was clicked is drawn on top of its neighbours
    var layer = e.feature.layer;
    var feature = e.feature;
    layer.eraseFeatures([feature]);
    layer.drawFeature(feature);

    // Keep track of selection in case layer is reloaded or hidden etc.
    selected_feature = feature.clone();
}

function asset_unselected(e) {
    fixmystreet.markers.setVisibility(true);
    $.each(this.fixmystreet.attributes, function (field_name, attribute_name) {
        $("#form_" + field_name).val("");
    });
    selected_feature = null;
}

function find_matching_feature(feature, layer) {
    if (!layer) {
        return false;
    }
    // When the WFS layer is reloaded the same features might be visible
    // but they'll be different instances of the class so we can't use
    // object identity comparisons.
    // This function will find the best matching feature based on its
    // attributes and distance from the original feature.
    var threshold = 1; // metres
    for (var i = 0; i < layer.features.length; i++) {
        var candidate = layer.features[i];
        var distance = candidate.geometry.distanceTo(feature.geometry);
        if (candidate.attributes.n == feature.attributes.n && distance <= threshold) {
            return candidate;
        }
    }
}

function check_zoom_message_visibility() {
    var category = $("#problem_form select#form_category").val(),
        prefix = this.fixmystreet.asset_category.replace(/[^a-z]/gi, ''),
        id = "category_meta_message_" + prefix,
        $p = $('#' + id);
    if (category == this.fixmystreet.asset_category) {
        if ($p.length === 0) {
            $p = $("<p>").prop("id", id);
            // #category_meta might not be here yet, but that's OK as the
            // element simply won't be added to the DOM.
            $p.insertAfter("#category_meta");
        }

        if (this.getVisibility() && this.inRange) {
            $p.html('Or pick a <b class="streetlight-spot">' + this.fixmystreet.asset_item + '</b> from the map &raquo;');
        } else {
            $p.html('Or zoom in and pick a ' + this.fixmystreet.asset_item + ' from the map');
        }

    } else {
        $p.remove();
    }
}

function layer_visibilitychanged() {
    check_zoom_message_visibility.call(this);
    var layers = fixmystreet.map.getLayersByName('WFS');
    var visible = 0;
    for (var i = 0; i<layers.length; i++) {
        if (layers[i].getVisibility()) {
            visible++;
        }
    }
    if (visible === 2 || visible === 0) {
        // We're either switching WFS layers (so going 1->2->1 or 1->0->1)
        // or switching off WFS layer (so going 1->0). Either way, we want
        // to show the marker again.
        fixmystreet.markers.setVisibility(true);
    }
    select_nearest_asset.call(this);
}

function zoom_to_assets(layer) {
    // This function is called when the asset category is
    // selected, and will zoom the map in to the first level that
    // makes the asset layer visible if it's not already shown.
    if (!layer.inRange) {
        var firstVisibleResolution = layer.resolutions[0];
        var zoomLevel = fixmystreet.map.getZoomForResolution(firstVisibleResolution);
        fixmystreet.map.zoomTo(zoomLevel);
    }
}

function get_select_control(layer) {
    var controls = fixmystreet.map.getControlsByClass('OpenLayers.Control.SelectFeature');
    for (var i=0; i<controls.length; i++) {
        var control = controls[i];
        if (control.layer == layer && !control.hover) {
            return control;
        }
    }
}

function select_nearest_asset() {
    // The user's green marker might be on the map the first time we show the
    // assets, so snap it to the closest asset marker if so.
    if (!fixmystreet.markers.getVisibility() || !(this.getVisibility() && this.inRange)) {
        return;
    }
    var threshold = 50; // metres
    var marker = fixmystreet.markers.features[0];
    if (marker === undefined) {
        // No marker to be found so bail out
        return;
    }
    var closest_feature;
    var closest_distance = null;
    for (var i = 0; i < this.features.length; i++) {
        var candidate = this.features[i];
        var distance = candidate.geometry.distanceTo(marker.geometry);
        if (closest_distance === null || distance < closest_distance) {
            closest_feature = candidate;
            closest_distance = distance;
        }
    }
    if (closest_distance <= threshold && !!closest_feature) {
        get_select_control(this).select(closest_feature);
    }
}

function layer_loadend() {
    select_nearest_asset.call(this);
    // Preserve the selected marker when panning/zooming, if it's still on the map
    if (selected_feature !== null && !(selected_feature in this.selectedFeatures)) {
        var replacement_feature = find_matching_feature(selected_feature, this);
        if (!!replacement_feature) {
            get_select_control(this).select(replacement_feature);
        }
    }
}

function get_asset_stylemap() {
    return new OpenLayers.StyleMap({
        'default': new OpenLayers.Style({
            fillColor: "#FFFF00",
            fillOpacity: 0.6,
            strokeColor: "#000000",
            strokeOpacity: 0.8,
            strokeWidth: 2,
            pointRadius: 6
        }),
        'select': new OpenLayers.Style({
            externalGraphic: fixmystreet.pin_prefix + "pin-spot.png",
            fillColor: "#55BB00",
            graphicWidth: 48,
            graphicHeight: 64,
            graphicXOffset: -24,
            graphicYOffset: -56,
            backgroundGraphic: fixmystreet.pin_prefix + "pin-shadow.png",
            backgroundWidth: 60,
            backgroundHeight: 30,
            backgroundXOffset: -7,
            backgroundYOffset: -22,
            popupYOffset: -40,
            graphicOpacity: 1.0
        }),
        'temporary': new OpenLayers.Style({
            fillColor: "#55BB00",
            fillOpacity: 0.8,
            strokeColor: "#000000",
            strokeOpacity: 1,
            strokeWidth: 2,
            pointRadius: 8,
            cursor: 'pointer'
        })
    });
}

function get_fault_stylemap() {
    return new OpenLayers.StyleMap({
        'default': new OpenLayers.Style({
            fillColor: "#FF6600",
            fillOpacity: 1,
            strokeColor: "#FF6600",
            strokeOpacity: 1,
            strokeWidth: 1.25,
            pointRadius: 8
        })
    });
}

fixmystreet.add_assets = function(options) {
    var asset_layer = null;
    var asset_fault_layer = null;

    function add_assets() {
        if (asset_layer !== null) {
            // Layer has already been added
            return;
        }
        if (window.fixmystreet === undefined) {
            // We're on a page without a map, yet somehow still got called...
            // Nothing to do.
            return;
        }
        if (fixmystreet.map === undefined) {
            // Map's not loaded yet, let's try again soon...
            setTimeout(add_assets, 250);
            return;
        }
        if (fixmystreet.page != 'new' && fixmystreet.page != 'around') {
            // We only want to show light markers when making a new report
            return;
        }

        // An interactive layer for selecting a street light
        var protocol_options = {
            version: "1.1.0",
            url: options.wfs_url,
            featureType: options.wfs_feature,
            geometryName: options.geometryName
        };
        if (fixmystreet.wmts_config) {
            protocol_options.srsName = fixmystreet.wmts_config.map_projection;
        }
        var protocol = new OpenLayers.Protocol.WFS(protocol_options);
        var layer_options = {
            fixmystreet: options,
            strategies: [new OpenLayers.Strategy.BBOX()],
            protocol: protocol,
            visibility: false,
            maxResolution: options.max_resolution,
            minResolution: options.min_resolution,
            styleMap: get_asset_stylemap()
        };
        if (fixmystreet.wmts_config) {
            layer_options.projection = new OpenLayers.Projection(fixmystreet.wmts_config.map_projection);
        }
        if (options.filter_key) {
            layer_options.filter = new OpenLayers.Filter.Comparison({
                type: OpenLayers.Filter.Comparison.EQUAL_TO,
                property: options.filter_key,
                value: options.filter_value
            });
        }
        asset_layer = new OpenLayers.Layer.Vector("WFS", layer_options);

        // A non-interactive layer to display existing street light faults
        if (options.wfs_fault_feature) {
            var po = {
                featureType: options.wfs_fault_feature
            };
            OpenLayers.Util.applyDefaults(po, protocol_options);
            var fault_protocol = new OpenLayers.Protocol.WFS(po);
            var lo = {
                strategies: [new OpenLayers.Strategy.BBOX()],
                protocol: fault_protocol,
                styleMap: get_fault_stylemap()
            };
            OpenLayers.Util.applyDefaults(lo, layer_options);
            asset_fault_layer = new OpenLayers.Layer.Vector("WFS", lo);
            asset_layer.fixmystreet.fault_layer = asset_fault_layer;
        }

        // Set up handlers for selecting/unselecting markers and panning/zooming the map
        var select_feature_control = new OpenLayers.Control.SelectFeature( asset_layer );
        asset_layer.events.register( 'featureselected', asset_layer, asset_selected);
        asset_layer.events.register( 'featureunselected', asset_layer, asset_unselected);
        asset_layer.events.register( 'loadend', asset_layer, layer_loadend);
        asset_layer.events.register( 'visibilitychanged', asset_layer, layer_visibilitychanged);
        fixmystreet.map.events.register( 'zoomend', asset_layer, check_zoom_message_visibility);
        // Set up handlers for simply hovering over a street light marker
        var hover_feature_control = new OpenLayers.Control.SelectFeature(
            asset_layer,
            {
                hover: true,
                highlightOnly: true,
                renderIntent: 'temporary'
            }
        );
        hover_feature_control.events.register('beforefeaturehighlighted', null, function(e) {
            // Don't let marker go from selected->hover state,
            // as it causes some mad flickering effect.
            if (e.feature.renderIntent == 'select') {
                return false;
            }
        });

        fixmystreet.map.addLayer(asset_layer);
        if (asset_fault_layer) {
            fixmystreet.map.addLayer(asset_fault_layer);
        }
        fixmystreet.map.addControl( hover_feature_control );
        hover_feature_control.activate();
        fixmystreet.map.addControl( select_feature_control );
        select_feature_control.activate();

        // Make sure the fault markers always appear beneath the street lights
        if (asset_fault_layer) {
            asset_fault_layer.setZIndex(asset_layer.getZIndex()-1);
        }

        // Show/hide the asset layer when the category is chosen
        $("#problem_form").on("change.category", "select#form_category", function(){
            var category = $(this).val();
            if (category == options.asset_category) {
                asset_layer.setVisibility(true);
                if (asset_fault_layer) {
                    asset_fault_layer.setVisibility(true);
                }
                zoom_to_assets(asset_layer);
            } else {
                asset_layer.setVisibility(false);
                if (asset_fault_layer) {
                    asset_fault_layer.setVisibility(false);
                }
            }
        });
    }

    // Make sure the assets get hidden if the back button is pressed
    fixmystreet.maps.display_around = (function(original) {
        function hide_assets() {
            asset_layer.setVisibility(false);
            if (asset_fault_layer) {
                asset_fault_layer.setVisibility(false);
            }
            fixmystreet.markers.setVisibility(true);
            original.apply(fixmystreet.maps);
        }
        return hide_assets;
    })(fixmystreet.maps.display_around);

    return add_assets;
};

})();
