import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Cart } from '../../shared/shop/cart.model';
import { Checkout } from '../../shared/shop/checkout.model';
import { CartService } from '../../shared/shop/cart.service';
import { CheckoutService } from '../../shared/shop/checkout.service';
import { StripeService } from '../../shared/shop/stripe.service';
import { Account, Principal } from '../../shared';
import { JhiEventManager } from 'ng-jhipster';
import { CardDTO } from '../../shared/dto/card.dto';
import { OrderDTO } from '../../shared/dto/order.dto';
import { UUIDService } from '../../shared/uuid/uuid.service';
import * as brainblocks from 'brainblocks';
import { Observable } from 'rxjs';
require('bootstrap');

@Component({
  selector: 'jhi-checkout2',
  templateUrl: './checkout2.component.html'
})
export class Checkout2Component implements OnInit {
    account: Account;
    cardDTO: CardDTO;
    orderDTO: OrderDTO;
    cart: Cart[] = [];
    checkoutData: Checkout;
    createOrdersArray = [];
    shippingPrice = 0;
    tax = 20;
    totalCartPrice = 0;
    uuid: number;
    totalCartQuantity: number;
    loading = false;

    constructor(private router: Router,
                private principal: Principal,
                private eventManager: JhiEventManager,
                private cartService: CartService,
                private checkoutService: CheckoutService,
                private stripeService: StripeService,
                private uuidService: UUIDService) {
        this.checkoutData = new Checkout;
        this.cardDTO = new CardDTO;
    }

    brainblocksRender() {
        brainblocks.Button.render({

            // Pass in payment options
            payment: {
                destination: 'nano_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y',
                currency:    'rai',
                amount:      1000
            },

            // Handle successful payments
            onPayment(data) {
                console.log('Payment successful!', data.token);
                this.checkout();
            }

        }, '#nano-button');
    }

    ngOnInit() {
        this.loading = false;
        this.brainblocksRender();
        this.principal.identity().then((account) => {
            this.account = account;
            this.uuid = this.uuidService.getUUID(account);
            this.updateCart();
            this.checkoutData = this.loadCheckoutData();
            this.orderDTO = this.checkoutService.getOrderDTO();
        });
        this.registerAuthenticationSuccess();
    }

    isAuthenticated() {
        return this.principal.isAuthenticated();
    }

    updateCart() {
        if (this.account != null) {
            this.cartService.getCartByUserId(this.account.id).subscribe((cartData) => {
                this.cart = cartData;
                this.getTotalCartQuantity(cartData);
                this.total();
            });
        } else {
            console.log('updateCart() with this.uuid: ' + this.uuid);
            this.cartService.getCartByUserId(this.uuid).subscribe((cartData) => {
                this.cart = cartData;
                this.getTotalCartQuantity(cartData);
                this.total();
            });
        }
    }

    total() {
        let totalCalculatedValue = 0;
        this.cart.forEach(function(item) {
            totalCalculatedValue += item.cartItemQuantity * item.productsPrice;
        });
        this.totalCartPrice = totalCalculatedValue;
        return this.totalCartPrice;
    }

    shipping() {
        let shipping = 0;

        if (this.total() < 100) {
            shipping = 25;
        } else {
            shipping = 0;
        }

        this.shippingPrice = shipping;
        return shipping;
    }

    totalCharge() {
        return this.totalCartPrice + this.shippingPrice + this.tax;
    }

    registerAuthenticationSuccess() {
        this.eventManager.subscribe('authenticationSuccess', (message) => {
            this.principal.identity().then((account) => {
                this.account = account;
                this.updateCart();
            });
        });
    }

    loadCheckoutData() {
        return this.checkoutService.loadCheckoutData();
    }

    checkout() {
        this.loading = true;
        const cardInfo = this.cardDTO;
        const orderDTO = this.finishCreatingOrderDTO();
        // Create the order
        this.checkoutService.createOrder(orderDTO)
            // Then charge using Stripe payment
            .subscribe(() => {
                this.stripeService.charge(this.totalCharge() * 100, cardInfo)
            // Then update the status of the order to 'paid'
            .subscribe((res) => {
                const orderDTOWithChargeId = this.createOrderDTOWithChargeId(res);
                this.checkoutService.updateChargeId(orderDTOWithChargeId)
            .subscribe(() => {
                // Then navigate back to the home page
                // TODO: save data to display on confirmation screen
                this.router.navigateByUrl('/confirmation');
            }, (error) => {
                this.router.navigateByUrl('/');
                });
            }, (error) => {
                this.router.navigateByUrl('/');
                });
            }, (error) => {
                this.router.navigateByUrl('/');
                });
    }

    finishCreatingOrderDTO() {
        let userId;
        if (this.account !== null) {
            userId = this.account.id;
        } else {
            userId = this.uuid;
        }
        this.orderDTO.id = userId;
        this.orderDTO.shippingCost = this.shipping();
        return this.orderDTO;
    }

    createOrderDTOWithChargeId(chargeRecord) {
        this.orderDTO.stripeCardOwner = this.cardDTO.owner;
        this.orderDTO.stripeChargeId = chargeRecord.id;
        return this.orderDTO;
    }

    getTotalCartQuantity(cartData) {
        let totalQuantity = 0;
        for (const cartRecord of cartData) {
            totalQuantity += cartRecord.cartItemQuantity;
        }
        this.totalCartQuantity = totalQuantity;
    }

    isLoading() {
        return this.loading;
    }
}
