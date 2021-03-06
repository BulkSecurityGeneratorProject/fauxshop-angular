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
import { OrdersProducts } from '../../shared/shop/ordersProducts.model';
require('bootstrap');

@Component({
  selector: 'jhi-confirmation',
  templateUrl: './confirmation.component.html'
})
export class ConfirmationComponent implements OnInit {
    account: Account;
    cardDTO: CardDTO;
    orderDTO: OrderDTO;
    cart: Cart[] = [];
    checkoutData: Checkout;
    createOrdersArray = [];
    shippingPrice = 0;
    tax = 20;
    totalOrderPrice = 0;
    uuid: number;
    ordersProducts: OrdersProducts[];

    constructor(private router: Router,
                private principal: Principal,
                private eventManager: JhiEventManager,
                private cartService: CartService,
                private checkoutService: CheckoutService,
                private stripeService: StripeService,
                private uuidService: UUIDService) {
    }

    ngOnInit() {
        this.principal.identity().then((account) => {
            this.account = account;
            this.uuid = this.uuidService.getUUID(account);
            this.updateCart();
            this.checkoutData = this.loadCheckoutData();
            this.orderDTO = this.checkoutService.getOrderDTO();
            this.populateOrdersProducts();
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
            });
        } else {
            console.log('updateCart() with this.uuid: ' + this.uuid);
            this.cartService.getCartByUserId(this.uuid).subscribe((cartData) => {
                this.cart = cartData;
            });
        }
    }

    total() {
        let totalCalculatedValue = 0;
        this.ordersProducts.forEach(function(item) {
            totalCalculatedValue += item.productsPrice * item.productsQuantity;
        });
        this.totalOrderPrice = totalCalculatedValue;
        return this.totalOrderPrice;
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
        return this.totalOrderPrice + this.shippingPrice + this.tax;
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

    checkout(event) {
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
                this.router.navigateByUrl('/');
            });
            });
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

    populateOrdersProducts() {
        this.checkoutService.getOrdersProducts(this.checkoutService.getOrderDTO().orderId).subscribe((ordersProducts) => {
            this.ordersProducts = ordersProducts;
            this.total();
        });
    }

}
