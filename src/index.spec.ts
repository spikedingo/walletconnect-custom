import { createWeb3ReactStoreAndActions } from '@web3-react/store'
import type { Actions, RequestArguments, Web3ReactStore } from '@web3-react/types'
import EventEmitter from 'node:events'
import { WalletConnect } from '.'
import { MockEIP1193Provider } from '../../eip1193/src/mock'

// necessary because walletconnect returns chainId as a number
class MockMockWalletConnectProvider extends MockEIP1193Provider {
  public connector = new EventEmitter()

  public eth_chainId_number = jest.fn((chainId?: string) =>
    chainId === undefined ? chainId : Number.parseInt(chainId, 16)
  )

  public request(x: RequestArguments): Promise<unknown> {
    if (x.method === 'eth_chainId') {
      return Promise.resolve(this.eth_chainId_number(this.chainId))
    } else {
      return super.request(x)
    }
  }

  /**
   * TODO(INFRA-140): We're using the following private API to fix an underlying WalletConnect issue.
   * See {@link WalletConnect.activate} for details.
   */
  private setHttpProvider() {}
}

jest.mock('@walletconnect/ethereum-provider', () => MockMockWalletConnectProvider)

const chainId = '0x1'
const accounts: string[] = []

describe('WalletConnect', () => {
  let store: Web3ReactStore
  let connector: WalletConnect
  let mockProvider: MockMockWalletConnectProvider

  describe('works', () => {
    beforeEach(async () => {
      let actions: Actions
      ;[store, actions] = createWeb3ReactStoreAndActions()
      connector = new WalletConnect({ actions, options: { rpc: {} } })
    })

    test('#activate', async () => {
      await connector.connectEagerly().catch(() => {})

      mockProvider = connector.provider as unknown as MockMockWalletConnectProvider
      mockProvider.chainId = chainId
      mockProvider.accounts = accounts

      await connector.activate()

      expect(mockProvider.eth_requestAccounts).toHaveBeenCalled()
      expect(mockProvider.eth_accounts).not.toHaveBeenCalled()
      expect(mockProvider.eth_chainId_number).toHaveBeenCalled()
      expect(mockProvider.eth_chainId_number.mock.invocationCallOrder[0])
        .toBeGreaterThan(mockProvider.eth_requestAccounts.mock.invocationCallOrder[0])

      expect(store.getState()).toEqual({
        chainId: Number.parseInt(chainId, 16),
        accounts,
        activating: false,
        error: undefined,
      })
    })
  })
})
