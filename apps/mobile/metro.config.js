const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages so Metro picks up source changes
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app and the monorepo root, app takes priority
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force a single copy of React and React Native regardless of which package
// is doing the importing. Without this, workspace packages that list react as
// a devDependency (e.g. packages/hooks) cause Metro to resolve a second copy,
// breaking the Rules of Hooks at runtime.
const reactPath = require.resolve("react", { paths: [projectRoot] });
const reactNativePath = require.resolve("react-native", { paths: [projectRoot] });

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react") {
    return { filePath: reactPath, type: "sourceFile" };
  }
  if (moduleName === "react-native") {
    return { filePath: reactNativePath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
