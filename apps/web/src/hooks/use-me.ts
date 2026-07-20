import useSWR from "swr";
import { fetchAPI } from "../api";
import type { UserInfo } from "../lib/user";

export function useMe() {
	return useSWR<UserInfo>("/api/me", fetchAPI, {
		revalidateOnFocus: false,
		revalidateIfStale: false,
		dedupingInterval: 60_000,
	});
}
