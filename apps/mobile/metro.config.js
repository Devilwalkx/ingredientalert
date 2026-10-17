const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The core package is TypeScript source using NodeNext-style "./x.js" specifiers.
// Map relative ".js" imports to the extensionless path so Metro finds the .ts file.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName.startsWith(".") && moduleName.endsWith(".js") ? moduleName.slice(0, -3) : moduleName;
  const fallback = defaultResolve ?? context.resolveRequest;
  if (target !== moduleName) {
    try {
      return fallback(context, target, platform);
    } catch {
      // fall through to the original specifier
    }
  }
  return fallback(context, moduleName, platform);
};

module.exports = config;
