# module-avr8js

AVR8js-Simulator for edrys import the module via:

`https://edrys-labs.github.io/edrys_module-avr8js/index.html`

## Settings

The basic wokwi-webcomponents can be set within modules.
This will be added below the terminal.
Additionally, the module will listen to messages on execute, this way external editors can be used and send their output.

``` yaml
modules: |
  <wokwi-led color='red'   pin='13' label='13'></wokwi-led>
  <wokwi-led color='green' pin='12' label='12'></wokwi-led>
  <wokwi-led color='blue'  pin='11' label='11'></wokwi-led>
  <wokwi-led color='blue'  pin='10' label='10'></wokwi-led>
  <span id='simulation-time'></span>

execute: execute
```

or as JSON

``` json
{
  "modules": "<wokwi-led color='red'   pin='13' label='13'></wokwi-led>\n<wokwi-led color='green' pin='12' label='12'></wokwi-led>\n<wokwi-led color='blue'  pin='11' label='11'></wokwi-led>\n<wokwi-led color='blue'  pin='10' label='10'></wokwi-led>\n<span id='simulation-time'></span>",
  "execute": "execute"
}
```
