var syncStylesWith = function (context) {

  var doc = context.document.documentData();
  var lookups = {
    layer: createLookup(doc.layerStyles()),
    text: createLookup(doc.layerTextStyles())
  };

  var options = [];
  AppController.sharedInstance().librariesController().libraries().forEach(function(lib){
    options.push(lib.name());
  });

  var alert = COSAlertWindow.new();
  alert.setMessageText('Choose library for sync:');

  var select = NSComboBox.alloc().initWithFrame(NSMakeRect(0,0,200,25));
  select.i18nObjectValues = options;
  select.setEditable(false);
  select.addItemsWithObjectValues(options);
  select.selectItemAtIndex(0);
  alert.addAccessoryView(select);

  alert.addButtonWithTitle('Sync');
	alert.addButtonWithTitle('Cancel');

  if(alert.runModal() == NSAlertFirstButtonReturn)
  {
    var chosenLibrary = alert.viewAtIndex(0).stringValue();
    AppController.sharedInstance().librariesController().libraries().forEach(function(lib){
      if(lib.name() == chosenLibrary){
        syncLibraryStyles(lib.document().layerStyles(), doc.layerStyles(), lookups.layer);
        syncLibraryStyles(lib.document().layerTextStyles(), doc.layerTextStyles(), lookups.text);
        context.document.showMessage('Synced styles with ' + chosenLibrary);
      }
    });
  }
}

var syncStyles = function (context) {
  var doc = context.document.documentData();

  var lookups = {
    layer: createLookup(doc.layerStyles()),
    text: createLookup(doc.layerTextStyles())
  };

  var validLibraries = 0;

  var librarySymbols = doc.foreignSymbols();
  var seenLibraries = {};
  librarySymbols.forEach(function (symbol) {
    var libraryID = symbol.libraryID();
    if (!seenLibraries[libraryID]) {
      seenLibraries[libraryID] = true;
      var library = librariesController().libraryForSymbol_(symbol.symbolMaster());
      if (library && library.document()) {
        validLibraries++;
        syncLibraryStyles(library.document().layerStyles(), doc.layerStyles(), lookups.layer);
        syncLibraryStyles(library.document().layerTextStyles(), doc.layerTextStyles(), lookups.text);
      }
    }
  });

  context.document.reloadInspector();

  var objects = (validLibraries === 1) ? 'library' : 'libraries';
  context.document.showMessage('Synced styles with ' + validLibraries + ' ' + objects);
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
  var result = {created: 0};

  createStyles(typography, colors, doc.layerTextStyles(), currentStyles, '', result);

  context.document.reloadInspector();
  context.document.showMessage('Synced ' + result.created + ' styles from JSON');
};

var createStyles = function (typography, colors, sharedStyles, currentStyles, path, result) {
  var properties = {};
  var styleColors = [];

  for (var key in typography) {
    if (typography.hasOwnProperty(key)) {
      var value = typography[key];
      if (typeof value === 'object' && !value[0]) {
        createStyles(value, colors, sharedStyles, currentStyles, path + '/' + key, result);
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
    result.created++;
  } else {
    for (var i = 0; i < styleColors.length; ++i) {
      var colorString = styleColors[i];
      properties['color'] = colors[colorString];
      var capitalColorString = colorString.charAt(0).toUpperCase() + colorString.slice(1);
      createStyle(path.substr(1) + '/' + capitalColorString, properties,
        sharedStyles, currentStyles);
      result.created++;
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
