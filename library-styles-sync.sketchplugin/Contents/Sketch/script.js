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
