import { localize } from '@/utils/tmp/dummy';

window.Blockly.Blocks.text = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: '%1',
            args0: [
                {
                    type: 'field_input',
                    name: 'TEXT',
                },
            ],
            output: 'String',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Enter some text here'),
            category: window.Blockly.Categories.Text,
        };
    },
    meta() {
        return {
            display_name: localize('Text'),
            description: localize('A  block that can contain text.'),
        };
    },
};

window.Blockly.JavaScript.text = block => {
    // eslint-disable-next-line no-underscore-dangle
    const code = window.Blockly.JavaScript.quote_(block.getFieldValue('TEXT'));
    return [code, window.Blockly.JavaScript.ORDER_ATOMIC];
};
