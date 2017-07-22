export function getStoreLimits(): {
    textTrainingItemsPerProject: number,
    numberTrainingItemsPerProject: number,
    imageTrainingItemsPerProject: number,
} {
    return {
        textTrainingItemsPerProject : 500,
        numberTrainingItemsPerProject : 1000,
        imageTrainingItemsPerProject : 200,
    };
}
