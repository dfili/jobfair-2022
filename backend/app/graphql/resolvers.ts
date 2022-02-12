import {
  readdirSync,
} from "fs";
import path from "path";
import type {
  BuildSchemaOptions,
} from "type-graphql/dist/utils/buildSchema";

const dirname = __filename.split(".").slice(0, -1).join(".");

const files = readdirSync(dirname).map((file) => path.join(dirname, file));

const required = files.map((file) => Object.values(require(file) as unknown[]));

export default required.flat(Infinity) as BuildSchemaOptions["resolvers"];
