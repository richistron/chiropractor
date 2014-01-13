wiser jquery.cors
=================

Installation:

* copy jquery.cors folder to your application root folder
  example:
  `cp -r src/components/chiropractor/jquery.cors src/`
* add shim values
```
shim: {
  'json2': { exports: 'JSON' },
  'jquery.cors/easyxdm/easyxdm': { exports: 'easyXDM' },
  'easyxdm': {
  deps: ['json2'],
  exports: 'easyXDM'
  },
  'console-shim': { exports: 'console' }
}
```
* add new copy task inside your grunt file, you need jquery.cors folder
  inside your build folder
