import { FTypo, FGrid, FTable, FHeader, FButton } from "ferrum-design-system";
import { useEffect, useState } from "react";
import Datatable from "react-bs-datatable";
import { useDispatch, useSelector } from "react-redux";
import { crucibleApi } from "../client";
import { fetchWithdrawals } from "../redux/casper/casperActions";
import { Networks } from "../utils/stringUtils";
import { CasperWithdrawal } from "../pages/CasperWithdrawal";
import FerrumJson from "../utils/contract.json";

import './layout.scss';
import { Web3Helper } from "../utils/web3Helper";
import { MetaMaskConnector } from "./connector";
import { ConnectWalletDialog } from "../utils/connect-wallet/ConnectWalletDialog";
import { CasperServiceByJsonRPC, CLPublicKey, CLValue, 
    CLValueBuilder, 
    decodeBase16, 
    DeployUtil,
    RuntimeArgs,
    Signer,
    CasperClient
  } from "casper-js-sdk";
  import toast from "react-hot-toast";
import { useHistory } from "react-router";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import TxProcessingDialog from "../dialogs/TxProcessingDialog";
import Web3 from "web3";
import { networksToChainIdMap } from "../utils/network";


const RPC_API = "https://casper-proxy-app-03c23ef9f855.herokuapp.com?url=http://44.208.234.65:7777/rpc";

const casperService = new CasperServiceByJsonRPC(RPC_API);
const casperClient = new CasperClient(RPC_API);

export const Withdrawals = () => {
    const { connect: { config, selectedAccount, isWalletConnected, withdrawalItems } } = useSelector((state: any) => state.casper);
    const { walletAddress, isConnected, networkClient, currentWalletNetwork } = useSelector((state: any) => state.casper.walletConnector);
    const [loading, setLoading] = useState(false);
    const [processMsg, setProcessMsg] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const navigate = useHistory();

    const dispatch = useDispatch();

    async function withdrawEvm(id: string, item: any):Promise<any>{
        //@ts-ignore
        const networkData = networksToChainIdMap[currentWalletNetwork]
        const Api = new crucibleApi()
        await Api.signInToServer(walletAddress)
            const res = await Api.gatewayApi({
              "command": "updateEvmAndNonEvmTransaction",
               "data": {
                "id": id,
                "txType": "swap",
                "sendNetwork": `${networkData?.sendCurrencyFormatted || networkData?.sendNetwork || 'BSC_TESTNET'}`,
                "used": "",
                "user": "0x0Bdb79846e8331A19A65430363f240Ec8aCC2A52",
                "sendAddress": "0x0Bdb79846e8331A19A65430363f240Ec8aCC2A52",
                "receiveAddress": "017fbbccf39a639a1a5f469e3fb210d9f355b532bd786f945409f0fc9a8c6313b1",
                "sendCurrency": networkData?.sendCurrency || `${networkData.sendNetwork}:0xfe00ee6f00dd7ed533157f6250656b4e007e7179`,
                "sendAmount":  Web3.utils.toWei(item.sendAmount, 'ether'),
                "receiveCurrency": "CSPR:222974816f70ca96fc4002a696bb552e2959d3463158cd82a7bfc8a94c03473"
              },
              "params": []
            });
        if (res.data) {
          const helper = new Web3Helper(networkClient)
          const tx = await helper.sendTransactionAsync(
            dispatch,
            [res.data]
          )
          if(tx) {
            setShowConfirmation(true)
          }
        }
    }    

    const fetchEvmWithdrawalItems = async () => {
        const Api = new crucibleApi()
        await Api.signInToServer(`CSPR:${selectedAccount?.address}`)
        const userWithdrawals = await Api.gatewayApi({
            command: 'getUserNonEvmWithdrawItems', data: {
            userAddress: `${selectedAccount?.address}`,
            network: "MUMBAI_TESTNET",
            receiveAddress: walletAddress,
        }, params: [] });
        if (userWithdrawals.data){
            await fetchWithdrawals(userWithdrawals.data.withdrawableBalanceItems)(dispatch);
        }
    }

    const performCasperWithdraw = async (amount: string) => {
        if (
          isWalletConnected &&
          selectedAccount
        ) {
          //@ts-ignore
          const casperWalletProvider = await window.CasperWalletProvider;    
          const provider = casperWalletProvider();
          try {
            // (selectedAccount?.address, Number(amount));
            const publicKeyHex = selectedAccount?.address;
            const senderPublicKey = CLPublicKey.fromHex(publicKeyHex);

            const deployParams = new DeployUtil.DeployParams(
            senderPublicKey,
            'casper-test'
            );

            const args = RuntimeArgs.fromMap({
                "amount": CLValueBuilder.u256(Number(amount).toFixed()),
                "token_address": CLValueBuilder.string('contract-package-wasme222974816f70ca96fc4002a696bb552e2959d3463158cd82a7bfc8a94c03473'),
            });
    
            const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
            decodeBase16('2eaf3bf2cbc8e46f56ce04904592aa530141170fbee3473baeba4edfe9e87513'),
            'withdraw',
            args
            );

            const payment = DeployUtil.standardPayment(10000000000);

            const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

            const deployJson: any = DeployUtil.deployToJson(deploy);
        
            provider.sign(JSON.stringify(deployJson), publicKeyHex).then(async (signedDeployJson: any) => {
                const signedDeploy = DeployUtil.setSignature(
                  deploy,
                  signedDeployJson.signature,
                  CLPublicKey.fromHex(publicKeyHex)
                );

                if (signedDeploy) {
                    const res = await casperClient.putDeploy(signedDeploy);
                    console.log(res, 'resres');
                    if (res) {
                    
                    }
                    setProcessMsg(res)
                    setLoading(false)
                    setShowConfirmation(true)
                }
            });
              // navigate.push(`/${config._id}`);
            //toast.success(`${amount} tokens are staked successfully`);
            
            } catch (e) {
              console.log("ERROR : ", e);
                toast.error("An error occured please see console for details");
                navigate.push(`/${config._id}`);
            } finally {
            //setLoading(false)
            }

        } else {
            navigate.push(`/${config._id}`);
        }
    };
        


    useEffect(() => {
       fetchEvmWithdrawalItems()
    }, [selectedAccount, walletAddress]);

    const tableHeads: any[] = [
        { width: 200, prop: "sourceNetwork", title: "Source Network" },
        { prop: "targetNetwork", title: "Target Network" },
        { prop: "amount", title: "Amount" },
        { prop: "action", title: "Action" }
    ];


    const body = (withdrawalItems || []).map((item: any) => { 
        return {
          amount: <FTypo className={"col-amount"}>{item.sendAmount}</FTypo>,
          sourceNetwork: <FTypo className={"col-amount"}>{
            //@ts-ignore
            Networks[item.sendNetwork] || item.sendNetwork
        }</FTypo>,
          targetNetwork: <FTypo className={"col-amount"}>{
            //@ts-ignore
            Networks[item.receiveNetwork] || item.receiveCurrency.split(":")[0]
        }</FTypo>,
          action: (
            <div className="col-action">
            {
                isConnected
                ? (<FButton title={"Withdraw"} onClick={() => 
                  item.receiveCurrency.split(":")[0] === 'CSPR' ? performCasperWithdraw(item.sendAmount) : withdrawEvm(item.id, item)
                } />)
                : (
                    <MetaMaskConnector.WalletConnector
                      WalletConnectView={FButton}
                      WalletConnectModal={ConnectWalletDialog}
                      isAuthenticationNeeded={false}
                      WalletConnectViewProps={{ className: "w-100" }}
                    />
                )
            }
            </div>
          ),
        }; 
    }); 

    return (
        <>
            <FGrid alignX={"center"} className="f-mb-1 withdrawals_container">
                <FTypo size={18} align={"center"} className={"f-mb-14 f-mt--7"}>
                    TOKEN WITHDRAWALS
                </FTypo>
                <FTable>
                    <Datatable tableBody={body || []} tableHeaders={tableHeads} rowsPerPage={10} />
                </FTable>
            </FGrid>
            <ConfirmationDialog onHide={() =>setShowConfirmation(false)} transaction={processMsg} message={'Transaction sent to network and is processing.'} show={showConfirmation} isSwap={false} />
            <TxProcessingDialog onHide={() =>setLoading(false)} message={ processMsg || "Transaction Processing...."} show={loading}/>
        </>
    )
}