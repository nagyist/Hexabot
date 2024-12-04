/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import { useMutation } from 'react-query';

import { TMutationOptions } from '@/services/types';
import { IResetPayload, IResetRequest } from '@/types/reset.types';

import { useApiClient } from '../useApiClient';

export const useRequestResetPassword = (
  options?: Omit<
    TMutationOptions<void, Error, IResetRequest, unknown>,
    'mutationFn'
  >,
) => {
  const { apiClient } = useApiClient();

  return useMutation<void, Error, IResetRequest>({
    ...options,
    mutationFn: async (payload) => {
      return await apiClient.requestReset(payload);
    },
  });
};

export const useResetPassword = (
  token: string,
  options?: Omit<
    TMutationOptions<void, Error, IResetPayload, unknown>,
    'mutationFn'
  >,
) => {
  const { apiClient } = useApiClient();

  return useMutation<void, Error, IResetPayload>({
    ...options,
    mutationFn: async (payload) => {
      return await apiClient.reset(token, payload);
    },
  });
};
