var syncStyles = function (context) {
  var doc = context.document.documentData();

  var lookups = {
    layer: createLookup(doc.layerStyles()),
    text: createLookup(doc.layerTextStyles())
  };

  var librarySymbols = doc.foreignSymbols();
  var seenLibraries = {};
  librarySymbols.forEach(function (symbol) {
    var libraryID = symbol.libraryID();
    if (!seenLibraries[libraryID]) {
      seenLibraries[libraryID] = true;
      var library = librariesController().libraryForSymbol_(symbol.symbolMaster());
      syncLibraryStyles(library.document().layerStyles(), doc.layerStyles(), lookups.layer);
      syncLibraryStyles(library.document().layerTextStyles(), doc.layerTextStyles(), lookups.text);
    }
  });

  context.document.reloadInspector();

  var libCount = Object.keys(seenLibraries).length;
  var objects = (libCount === 1) ? 'library' : 'libraries';
  context.document.showMessage('Synced styles with ' + libCount + ' ' + objects);
};

var getUserDefaults = function () {
  return NSUserDefaults.alloc().initWithSuiteName('com.zeroheight.library-styles-sync');
};

var setColor = function () {
  var panel = MSModalInputSheet.alloc().init();
  var result = panel.runPanelWithNibName_ofType_initialString_label_('MSModalInputSheet',
    0, '', 'Enter colors JSON URL');
  var userDefaults = getUserDefaults();
  userDefaults.setObject_forKey(String(result), 'color_url');
  userDefaults.synchronize();
};

var setTypo = function () {
  var panel = MSModalInputSheet.alloc().init();
  var result = panel.runPanelWithNibName_ofType_initialString_label_('MSModalInputSheet',
    0, '', 'Enter typography JSON URL');
  var userDefaults = getUserDefaults();
  userDefaults.setObject_forKey(String(result), 'typo_url');
  userDefaults.synchronize();
};

var syncJSON = function (context) {
  var userDefaults = getUserDefaults();
  var colorUrl = userDefaults.objectForKey('color_url');
  var typoUrl = userDefaults.objectForKey('typo_url');

  if (!colorUrl || !typoUrl) {
    return showAlert('No URLs found', 'Enter a color and typography URLs using other actions');
  }

  var colors = {};
  var typography = {};

  try {
    var url = NSURL.URLWithString_(colorUrl);
    var content = NSString.stringWithContentsOfURL_encoding_error(url, NSASCIIStringEncoding, nil);
    colors = JSON.parse(content);
    url = NSURL.URLWithString_(typoUrl);
    content = NSString.stringWithContentsOfURL_encoding_error(url, NSASCIIStringEncoding, nil);
    typography = JSON.parse(content);
  } catch (e) {
    return showAlert('Invalid URLs', 'Something went wrong fetching or extracting content');
  }

  var doc = context.document.documentData();
  var currentStyles = createLookup(doc.layerTextStyles());

  createStyles(typography, colors, doc.layerTextStyles(), currentStyles, '');
};

var createStyles = function (typography, colors, sharedStyles, currentStyles, path) {
  var properties = {};
  var styleColors = [];

  for (var key in typography) {
    if (typography.hasOwnProperty(key)) {
      var value = typography[key];
      if (typeof value === 'object' && !value[0]) {
        createStyles(value, colors, sharedStyles, currentStyles, path + '/' + key);
      } else {
        if (key === 'color') {
          styleColors.push(value);
        } else if (key === 'colors') {
          styleColors = value;
        } else {
          properties[key] = value;
        }
      }
    }
  }

  if (Object.keys(properties).length === 0) {
    return;
  }

  if (styleColors.length === 0) {
    properties['color'] = colors.primary;
    createStyle(path.substr(1), properties, sharedStyles, currentStyles);
  } else {
    for (var i = 0; i < styleColors.length; ++i) {
      var colorString = styleColors[i];
      properties['color'] = colors[colorString];
      var capitalColorString = colorString.charAt(0).toUpperCase() + colorString.slice(1);
      createStyle(path.substr(1) + '/' + capitalColorString, properties,
        sharedStyles, currentStyles);
    }
  }
};

var createStyle = function (name, properties, sharedStyles, currentStyles) {
  var sharedStyle = MSSharedStyle.alloc().init();
  var color = properties.color || '#000';
  var nscolor = MSImmutableColor.colorWithSVGString_(color).NSColorWithColorSpace_(nil);
  var fontSize = parseInt(properties['font-size']);
  fontSize = isNaN(fontSize) ? 12 : fontSize;
  var lineHeight = parseInt(properties['line-height']);
  lineHeight = isNaN(lineHeight) ? null : lineHeight;
  var fontWeight = parseInt(properties['font-weight']);
  var weight = 'Regular';
  switch (fontWeight) {
    case 400:
      weight = 'Medium';
      break;
    case 700:
      weight = 'Bold';
      break;
  }
  var fontName = 'SFUIText-' + weight;
  var attributes = {
    'NSColor': nscolor,
    'NSFont': NSFont.fontWithName_size_(fontName, fontSize)
  };
  if (lineHeight) {
    var para = NSMutableParagraphStyle.alloc().init();
    para.maximumLineHeight = lineHeight;
    para.minimumLineHeight = lineHeight;
    attributes['NSParagraphStyle'] = para;
  }
  var newStyle = MSStyle.alloc().init();
  var tstyle = MSTextStyle.styleWithAttributes_(attributes);
  newStyle.setValue_forKey_(tstyle, 'textStyle');

  var currentStyle = currentStyles[name];
  if (currentStyle) {
    sharedStyles.updateValueOfSharedObject_byCopyingInstance_(currentStyle, newStyle);
    sharedStyles.synchroniseInstancesOfSharedObject_withInstance_(currentStyle, newStyle);
  } else {
    sharedStyles.addSharedObjectWithName_firstInstance(name, newStyle);
  }
};

var showAlert = function (title, message) {
  var app = NSApplication.sharedApplication();
  app.displayDialog_withTitle('Enter a color and typography URLs using other actions',
      'No URLs found');
};

var createLookup = function (styles) {
  var lookup = {};
  styles.sharedStyles().forEach(function (style) {
    var name = style.name();
    lookup[name] = style;
  });
  return lookup;
};

var syncLibraryStyles = function (libraryStyles, documentStyles, lookup) {
  libraryStyles.sharedStyles().forEach(function (librarySharedStyle) {
    var name = librarySharedStyle.name();
    var currentStyle = lookup[name];
    var libraryStyle = librarySharedStyle.style();
    if (currentStyle) {
      documentStyles.updateValueOfSharedObject_byCopyingInstance_(currentStyle, libraryStyle);
      documentStyles.synchroniseInstancesOfSharedObject_withInstance_(currentStyle, libraryStyle);
    } else {
      documentStyles.addSharedObjectWithName_firstInstance(name, libraryStyle);
    }
  });
};

var librariesController = function () {
  return AppController.sharedInstance().librariesController();
};
