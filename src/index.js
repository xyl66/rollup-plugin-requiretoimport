const core = require("@babel/core");
const t = require("@babel/types");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const SUFFIX_QUEUE = ["jsx", "tsx", "js", "ts"];
function rollupPluginRequireinesm() {
  return {
    name: "rollup-plugin-requireinesm",
    transform(code, file) {
      if (
        /(node_modules)/.test(file) &&
        SUFFIX_QUEUE.includes(file.split(".").slice(-1)[0])
      ) {
        const ast = babelParser.parse(code, {
          sourceType: "module",
        });
        // 开始
        function requireVarToImport(path, _lastImport) {
          const { node, parent, parentPath } = path;
          function addImport(name, value, isAssign = false) {
            // 更改为import
            // t.importDeclaration(specifiers, source);
            // 创建specifiers
            // t.importDefaultSpecifier(local);
            const local = t.identifier(name);
            const specifier = t.importDefaultSpecifier(local);

            // 创建source
            const source = t.stringLiteral(value);
            let importObj = null;
            if (name === "") {
              importObj = t.importDeclaration([], source);
            } else {
              importObj = t.importDeclaration([specifier], source);
            }
            // 插入到顶部最后一个
            _lastImport.insertBefore(importObj);
            if (isAssign) {
              // 是assign a=require()时变为a=aImpt
              path.replaceWith(local);
            } else {
              // 删除父级变量 const a=require();
              parentPath.remove();
            }
          }
          // 父节点是否为变量
          switch (parent.type) {
            case "VariableDeclarator":
              addImport(parent.id.name, node.arguments[0].value);
              break;
            case "ExpressionStatement":
              addImport("", node.arguments[0].value);
              break;
            case "AssignmentExpression":
              addImport(
                parent.left.name + "Impt",
                node.arguments[0].value,
                true
              );
              break;
            default:
              break;
          }
        }
        let lastImport = null;
        let firstBody = null;
        traverse(ast, {
          Program(path, state) {
            const bodyNodes = path.get("body");
            lastImport = bodyNodes.filter((p) => p.isImportDeclaration()).pop();
            // 不存在import存在export时插入到最前面
            if (
              !lastImport &&
              bodyNodes.find((p) => p.isExportNamedDeclaration())
            ) {
              firstBody = bodyNodes[0];
            }
          },
          CallExpression(path, state) {
            // ObjectProperty 节点
            // 处理节点
            const { node } = path;
            const insertNode = lastImport || firstBody;
            if (insertNode && node.callee.name === "require") {
              requireVarToImport(path, insertNode);
            }
          },
        });
        lastImport = null;
        firstBody = null;
        return {
          code: core.transformFromAstSync(ast).code,
          map: this.getCombinedSourcemap && this.getCombinedSourcemap(),
        };
      }
      return {
        code,
        map: null,
      };
    },
  };
}
module.exports = rollupPluginRequireinesm;
rollupPluginRequireinesm["default"] = rollupPluginRequireinesm;
