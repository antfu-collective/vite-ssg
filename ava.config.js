module.exports = {
    "typescript": {
        "rewritePaths": {
            "src/": "dist/",
            "test/": "dist-test/"
        },
        "compile": false
    },
    "files": ["test/*.ts"]
}