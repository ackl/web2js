#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;

const basePath = '/usr/local/texlive/2024/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries';
const pgfcontribPath = '/usr/local/texlive/2024/texmf-dist/tex/generic/pgfplots/pgfcontrib/';
const pgflibsPath = '/usr/local/texlive/2024/texmf-dist/tex/generic/pgfplots/libs/';

fs.mkdirSync('tikz_libs', { recursive: true });

const processDir = (dir) => {
    for (let file of fs.readdirSync(dir, { withFileTypes: true })) {
        if (file.isDirectory()) {
            processDir(path.resolve(basePath, file.name));
        } else if (file.name.match(/^tikzlibrary.*\.code\.tex$/)) {
            let tikzLibName = file.name.replace(/^tikzlibrary(.*)\.code\.tex$/, '$1');
            console.log(`Processing ${tikzLibName}`);
            let texFile = `tikz_libs/${tikzLibName}.tex`;
            if (!fs.existsSync(texFile)) {
                console.log(`Creating ${texFile}`);
                fs.writeFileSync(
                    texFile,
                    //'\\documentclass[margin=0pt]{standalone}\n\\usepackage{tikz}\n' +
                    `\\usetikzlibrary{${tikzLibName}}\n\\begin{document}\n\\end{document}\n`
                );
            }
            console.log(`Running TeX on ${texFile}`);
            fs.writeFileSync(
                `tikz_libs/${tikzLibName}.output.log`,
                spawnSync('node', ['tex.js', texFile, 'y']).stdout.toString()
            );
            console.log(`TeX output saved to tikz_libs/${tikzLibName}.output.log`);

        }
    }
};
const processDirPgf = (dir) => {
    for (let file of fs.readdirSync(dir, { withFileTypes: true })) {
        if (file.isDirectory()) {
            processDir(path.resolve(basePath, file.name));
        } else if (file.name.match(/^tikzlibrary.*\.code\.tex$/)) {
            let tikzLibName = file.name.replace(/^tikzlibrary(.*)\.code\.tex$/, '$1');
            console.log(`Processing ${tikzLibName}`);
            let texFile = `tikz_libs/${tikzLibName}.tex`;
            if (!fs.existsSync(texFile)) {
                console.log(`Creating ${texFile}`);
                fs.writeFileSync(
                    texFile,
                    //'\\documentclass[margin=0pt]{standalone}\n\\usepackage{tikz}\n' +
                    `\\usetikzlibrary{${tikzLibName}}\n\\begin{document}\n\\end{document}\n`
                );
            }
            console.log(`Running TeX on ${texFile}`);
            fs.writeFileSync(
                `tikz_libs/${tikzLibName}.output.log`,
                spawnSync('node', ['tex.js', texFile, 'y']).stdout.toString()
            );
            console.log(`TeX output saved to tikz_libs/${tikzLibName}.output.log`);

        }
    }
};

processDir(basePath);
processDir(pgfcontribPath);
processDir(pgflibsPath);
