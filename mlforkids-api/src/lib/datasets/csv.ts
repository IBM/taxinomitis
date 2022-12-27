import * as Types from './set-types';



export function addTextDataForTesting(project: Types.DatasetProject, testItems: Array<{textdata: string, label: string}>): void {
    // prepare CSV-shaped version of the test data
    project.testdata = testItems.map((itm) => {
        return [ itm.textdata, itm.label ];
    });

    // add a header row
    project.testdata.unshift([ 'text', 'label' ]);
}


export function addNumbersDataForTesting(project: Types.DatasetProject, testItems: Array<{numberdata: number[], label: string}>): void {
    // prepare CSV-shaped version of the test data
    project.testdata = testItems.map((itm) => {
        const data: any[] = itm.numberdata.map((cell, idx) => {
            if (project.fields) {
                const field = project.fields[idx];
                if (field.type === 'multichoice' && field.choices) {
                    return field.choices[cell];
                }
            }
            return cell;
        });
        data.push(itm.label);
        return data;
    });

    // add a header row
    if (project.fields) {
        const header = project.fields.map((field) => field.name);
        header.push('label');
        project.testdata.unshift(header);
    }
}


export function addImageDataForTesting(project: Types.DatasetProject, testItems: Array<{imageurl: string, label: string}>): void {
    // prepare CSV-shaped version of the test data
    project.testdata = testItems.map((itm) => {
        return [ itm.imageurl, itm.label ];
    });

    // add a header row
    project.testdata.unshift([ 'url', 'label' ]);
}
