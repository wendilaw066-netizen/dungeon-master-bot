const log = ["Build failed: Not enough slot spaces! Needs 1 slots."];
const lastLogBefore = log[log.length-1];
log.push("Build failed: Not enough slot spaces! Needs 1 slots."); // simulated push
const lastLogAfter = log[log.length-1];

let isSuccess = false;
let successStr = {};
if (typeof successStr === 'string' && !successStr.includes('X')) {
    isSuccess = true;
} else if (lastLogAfter !== lastLogBefore) {
    if (!lastLogAfter.includes('fail') && !lastLogAfter.includes('Failed')) {
        isSuccess = true;
    }
}
console.log("isSuccess:", isSuccess);
console.log("lastLogBefore:", lastLogBefore);
console.log("lastLogAfter:", lastLogAfter);
