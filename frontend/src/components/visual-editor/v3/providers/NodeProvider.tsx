/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { useReactFlow } from "@xyflow/react";
import { useMemo } from "react";

import { NodeContext } from "../contexts/NodeContext";
import type { INodeContextProps } from "../types/node-context.types";
import type { NodeData } from "../types/visual-editor.types";
import { getBlockConfigByType } from "../utils/block.utils";

export const NodeProvider: React.FC<INodeContextProps> = ({ id, children }) => {
  const { getNode } = useReactFlow();
  const node = getNode(id) as NodeData | undefined;
  const value = useMemo(() => {
    if (!node) return null;

    const { data } = node;
    const { type } = data;

    return {
      id,
      node,
      data,
      config: {
        type,
        ...getBlockConfigByType(type),
      },
    };
  }, [id, node]);

  if (!value) return null;

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
};
